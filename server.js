"use strict";

const express = require('express');
const bodyParser = require('body-parser');
const url = require('url');
const utility = require('./app/utility');
const business = require('./app/business');
const debug = require('debug');

var app = express();
app.use(bodyParser.json({verify: utility.saveRawBody}));

const port = process.env.PORT || 5000;

// ============ Build ===========
function determineProviderType(headers) {
	if (headers.hasOwnProperty('x-gogs-event')) return 'gogs';
	if (headers.hasOwnProperty('x-github-event')) return 'github';
}

function extractProviderBody({headers}, body, type) {
	if (!body.repository) return;

	var payload = {
		providerType	: determineProviderType(headers),
		commitType	: body.ref_type,
		tag		: body.ref,
		repoUrl		: body.repository.url,
		name		: body.repository.name,
		archiveUrl	: body.repository.archive_url
	};

	if (payload.providerType === 'github') {
		payload.signature = headers['x-hub-signature'];
	}

	if (payload.providerType === 'gogs') {
		payload.secret = body.secret;
	}

	debug('docker-autobuild')(payload);

	return payload;
}

function computeDetails({name, repoUrl, tag, providerType, archiveUrl}) {
	const registryUrl = business.config().registry.serveraddress;

	return {
		registryTag	: `${registryUrl}/${name}:${tag}`,
		tarUrl		: getTarUrlFromRepo(repoUrl, tag, providerType, archiveUrl),
		providerAuth	: getProviderAuth(repoUrl)
	};
}

const getProviderAuth = repoUrl => {
	const host = utility.getHostFromUrl(repoUrl);
	return business.config().providers[host];
}

function getTarUrlFromRepo(repoUrl, tag, providerType, archiveUrl) {
	var downloadUrl;
	if (providerType === 'gogs') {
		downloadUrl = repoUrl + '/archive{/ref}.tar.gz';
	}

	if (providerType === 'github') {
		downloadUrl = archiveUrl;
	}

	return constructUrl(downloadUrl, tag);
}

function constructUrl(downloadUrl, tag) {
	return downloadUrl
		.replace('{archive_format}', 'tarball')
		.replace('{/ref}', '/' + tag);
}

function calcStatusUrl(req, tag) {
	return url.format({
		protocol: req.headers['x-forwarded-proto'] || req.protocol,
		host	: req.get('host'),
		pathname: `/api/tags/${tag}`
	});
}

app.use('/web', express.static('web'));

app.post('/hook', function (req, res) {
	const body = req.body;
	if (!body)
		return res.status(400).send('No body received');

	const payload = extractProviderBody(req, body);
	if (!payload)
		return res.status(400).send('Valid payload not received');

	if (!payload.providerType)
		return res.status(400).send('Unsupported Git provider');

	if (payload.commitType !== 'tag')
		return res.status(400).send('By design, only tags are built');

	if (business.config().secret) {
		if (payload.providerType === 'gogs') {
			if (!payload.secret) return res.status(401).send('Secret required');
			if (payload.secret !== business.config().secret)
				return res.status(401).status('Secrets do not match');
		}

		if (payload.providerType === 'github') {
//			if (!utility.validateSignature(req.rawBody, payload.signature, business.config().secret))
//				return res.status(401).send('GitHub signature match failed');
		}
	}

	const {tarUrl, registryTag, providerAuth} = computeDetails(payload);
	const statusUrl = calcStatusUrl(req, registryTag);

	res.json({status: 'Started', url: statusUrl});
	business.dockerBuildAndPush(tarUrl, registryTag, providerAuth, business.config().registry)
		.catch(error => console.log(error));
});

app.get('/api/tags', (req, res) => {
	res.json(business.getBuilds());
});

app.get('/api/tags/*', (req, res) => {
	const tag = req.params[0];
	res.json(biusiness.getBuilds()[tag]);
});

app.listen(port, function () {
	console.log(`Listening on port ${port}`);
});

"use strict";

const debug = require('debug');
const log = debug('docker-autobuild:utility');
const docker = new (require('dockerode'))();
const url = require('url');
const request = require('request');
const crypto = require('crypto');
var bufferEq = require('buffer-equal-constant-time');

const headers = {
	'User-Agent': 'docker-autobuild'
};

// ============== Docker Utility ==============
// Given a tar URL and tag, build an image. Promise
module.exports.dockerBuild = (tarUrl, tag, auth) => {
	log(`Building ${tarUrl} and tagging with ${tag}`);
	return new Promise((resolve, reject) => {
		const stream = request({url: tarUrl, headers: headers});
		console.log(auth);
		if (auth) stream.auth(auth.user, auth.password);
log(stream);
		return docker.buildImage(stream, {t: tag}, (err, stream) => {
			if (err) return reject(`Unable to build: ${err}`);
			var output = '';
			stream.on('data', d => console.log(d.toString()));
			stream.on('end', resolve);
		});
	});
}

module.exports.dockerPush = (tag, authConfig) => {
	const auth = { key: base64encodeJson(authConfig) };
	console.log(`Pushing to ${tag}`);
	return new Promise((resolve, reject) => {
		const image = docker.getImage(tag);
		if (!image) return reject(`Image with tag ${tag} not found`);

		image.push({authconfig: auth}, (err, data) => {
			if (err) return reject(`Unable to push image: ${err}`);
			if (data.statusCode !== 200) throw new Error (data.statusMessage);
			// TODO: More to determine if the push worked
			resolve();
		});
	});
}

module.exports.validateSignature = (rawBody, signature, secretKey) => {
	if (!(signature || secretKey)) { return true; }
	if (!(signature && secretKey)) { return false; }

	var algorithmAndHash = signature.split('=');
	if (algorithmAndHash.length !== 2) { return false; }

	try {
		// Replace bufferEq() once https://github.com/nodejs/node/issues/3043 is
		// resolved and the standard library implementation is available.
		var hmac = crypto.createHmac(algorithmAndHash[0], secretKey);
		var computed = new Buffer(hmac.update(rawBody, 'utf8').digest('hex'));
		var header = new Buffer(algorithmAndHash[1]);
		return bufferEq(computed, header);
	} catch (err) {
		console.log(err);
		return false;
	}
};

// ============== Generic Utility ==============
// Extract base part of URL
// For example: https://domain.com/user/repo =>  domain.com
module.exports.getHostFromUrl = (repoUrl) => url.parse(repoUrl).host;

// Extract the repoName, assuming it is the 2nd part of the path
// proto://domain/user/repoName => repoName
module.exports.extractRepoNameFromUrl = (repoUrl) => {
	const path = url.parse(repoUrl).path.split('/');
	return path[2];
}

const base64encodeJson = json => new Buffer(JSON.stringify(json)).toString('base64');

module.exports.saveRawBody = (req, res, buf, encoding) => {
        if (buf && buf.length) {
		req.rawBody = buf.toString(encoding || 'utf8');
	}
}

"use strict";

const jsonfile = require('jsonfile');
const debug = require('debug');
const utility = require('./utility');
const storagePath = './data/storage.json';
const log = debug('docker-autobuild:business');

var config;
var storage = { builds: {} };


module.exports = new class Storage {
		constructor() {
		try { config = jsonfile.readFileSync('./data/config.json'); } catch(e) {}
		try { storage = jsonfile.readFileSync(storagePath); } catch(e) {}
	}

	config() {
		return config;
	}

	dockerBuildAndPush(tarUrl, tag, providerAuth, registryAuth) {
		log({tarUrl: tarUrl, tag: tag, providerAuth: providerAuth, registryAuth: registryAuth});
		this.logBuild(tag, {
			status: 'Started'
		});
		// TODO log if failed (+msg)
		return utility.dockerBuild(tarUrl, tag, providerAuth)
			.then(() => {
				utility.dockerPush(tag, registryAuth);
				this.logBuildComplete(tag);
			});

}

	getBuilds() {
		return storage.builds;
	}

	logBuild(tag, status) {
		storage.builds[tag] = status;
		this.saveStorage();
	}

	logBuildComplete(tag) {
		storage.builds[tag].status = 'Complete';
		this.saveStorage();
	}

	saveStorage() {
		jsonfile.writeFileSync(storagePath, storage);
	}

};



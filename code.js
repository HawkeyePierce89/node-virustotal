var https = require("https");
var yellowStream = require("yellow-stream");
var speedconcat = require("speedconcat");
var request = require("request");
var apiKey = "e2513a75f92a4169e8a47b4ab1df757f83ae45008b4a8a49903450c8402add4d";
var PublicConnection = function(){
	var key = apiKey;
	var jobDelay = 15000;
	this.setKey = function(replacement){
		key = replacement;
		return;
	};
	this.getKey = function() {
		return key;
	};
	this.setDelay = function(replacement){
		jobDelay = replacement;
		return;
	};
	this.getDelay = function() {
		return jobDelay;
	};
	var jobQueue = null;
	var tail = null;
	var performNextJob = function(){
		if (jobQueue != null) {
			var workingJob = jobQueue;
			jobQueue = jobQueue.next;
			if (jobQueue == null) {
				tail = null;
			} else {
				setTimeout(performNextJob, jobDelay);
			}
			workingJob.proc();
		}
		return;
	};
	var addJob = function(proc) {
		if (jobQueue == null) {
			jobQueue = {
				proc: proc,
				next: null
			};
			tail = jobQueue;
			setTimeout(performNextJob, jobDelay);
		} else {
			tail.next = {
				proc: proc,
				next: null
			};
			tail = tail.next;
		}
		return;
	};
	var makeGet = function (URL) {
		return function(addr, responseProc, errProc){
			var checkURL = URL + addr + "&apikey=" + key;
			var checkProc = function(){
				https.get(checkURL, function(raw){
					var stream = new yellowStream.consolidator(raw);
					stream.on("error", function(e){
						errProc(e);
					});
					stream.on("end", function(data){
						var response = JSON.parse(data);
						switch(response.response_code) {
							case -2:
								addJob(checkProc);
								return;
							case 0:
							case 1:
								responseProc(data);
								return;
							case -1:
							default:
								errProc(data);
								return;
						}
					});
				});
			};
			addJob(checkProc);
		};
	};
	var PostWithoutBody = function(rawURL, mode) {
		return function(resource, responseProc, errProc){
			var fullURL = rawURL + resource + "&apikey=" + key;
			var jobProc = function(){
				request({
					method: "POST",
					url: fullURL
				},function(error, response, body){
					if (error) {
						errProc(error);
						return;
					}
					try{
						var result = JSON.parse(body);
						switch (result.response_code) {
							case -2:
								if (-2==mode) {
									addJob(jobProc);
									return;
								}
								if (-1==mode) {
									errProc(result);
									return;
								}
								if (0==mode) {
									responseProc(result);
									return;
								}
								return;
							case 1:
							case 0:
								responseProc(result);
								return;
							case -1:
							default:
								errProc(result);
								return;
						}
					} catch (e) {
						errProc(e);
						return;
					}
				});
			};
			addJob(jobProc);
		};
	};
	this.retrieveUrlAnalysis = PostWithoutBody("http://www.virustotal.com/vtapi/v2/url/report?resource=", -2);
	this.retrieveUrlAnalysisWithRescan = PostWithoutBody("http://www.virustotal.com/vtapi/v2/url/report?scan=1&resource=", -2);
	this.submitUrlForScanning = PostWithoutBody("https://www.virustotal.com/vtapi/v2/url/scan?url=", 0);
	this.checkIPv4 = makeGet("https://www.virustotal.com/vtapi/v2/ip-address/report?ip=");
	this.getDomainReport = makeGet("https://www.virustotal.com/vtapi/v2/domain/report?domain=");
	return;
};
var features = {};
features.MakePublicConnection = function(){
	return new PublicConnection();
};
features.MakeHoneypot2Connection = function(){
	var workingConnection = new PublicConnection();
	workingConnection.setDelay(1000);
	return workingConnection;
};
module.exports = exports = features;

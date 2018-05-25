var hfc = require('fabric-client');

var chainUtils = require('./utils/chainUtils.service')

var fs = require('fs');
var path = require('path');
var Q = require('q')
var util = require('util')

var ORGS = null

var service = {};
service.queryChaincode = queryChaincode;
service.invokeChaincode = invokeChaincode

module.exports = service;
/*
*   request needs following params :
*   1. chaincodeId
*   2. argList : query arguements
*   3. targets
*   4. organisation
*   5. channel
*   Example : 
*    var request = {
*       chaincodeId : "chaincode_name",
*       argList : ['chainCodeFunction','arg1'],
*       organisation : "org1",
*       targets: ["org1"],
*       channel : "mychannel"
*    }
*/
function queryChaincode(request){
    var deferred = Q.defer();
    if(request.chaincodeId == null || request.argList == null || request.targets == null || request.organisation == null || request.channel == null || request.userName == null){
        
        deferred.reject("Incorrect request format")

    }else{

        var org = request.organisation
        var chaincodeId =  request.chaincodeId;
        var argList = request.argList;

        var connectRequest = {
            channel: request.channel,
            targets: request.targets
        }

        var userName = request.userName;

        connectToChannel(connectRequest)
        .then(function({client, channel, ORGS}){
            chainUtils.getSubmitter(client, false, org, userName)
            .then(function(user){

                var tx_id = client.newTransactionID(user);
                // Prepare chain request
                var request = {
                    chaincodeId : chaincodeId,
                    txId: tx_id,
                    fcn: 'query',
                    args: argList
                };

                channel.queryByChaincode(request)
                .then(function(response_payloads){
                    if (response_payloads) {
                        for(let i = 0; i < response_payloads.length; i++) {
                            deferred.resolve(response_payloads[i].toString('utf8'))     
                        }
                    } else {
                        deferred.reject('response payload is null')     
                    }   
                })
                .catch(function(error){
                    deferred.reject(error) 
                })

            })
            .catch(function(err){
                deferred.reject(err)
            })

        })
        .catch(function(err){
            deferred.reject(err)
        })
    }

    return deferred.promise;
}
/*
*   request needs following params :
*   1. chaincodeId
*   2. argList : query arguements
*   3. targets
*   4. organisation
*   5. channel
*   Example : 
*    var request = {
*       chaincodeId : "chaincode_name",
*       argList : ['functionName','arg1', 'arg2'],
*       organisation : "org1",
*       targets: ["org1, org2"],
*       channel : "mychannel"
*    }
*/
function invokeChaincode(request){
    var deferred = Q.defer();

    var transactionSuccess = false

    if(request.chaincodeId == null || request.argList == null || request.targets == null || request.organisation == null || request.channel == null || request.userName == null){
        
        deferred.reject("Incorrect request format")

    }else{

        var org = request.organisation
        var chaincodeId =  request.chaincodeId;
        var argList = request.argList;

        var connectRequest = {
            channel: request.channel,
            targets: request.targets
        }

        var userName = request.userName;

        connectToChannel(connectRequest)
        .then(function({client, channel, ORGS}){

            chainUtils.getSubmitter(client, false, org, userName)
            .then(function(user){

                if (ORGS.hasOwnProperty(org) && typeof ORGS[org].peer1 !== 'undefined') {
                    // Connect to Transaction eventHUB
                    let data = fs.readFileSync(path.join(__dirname, ORGS[org].peer1['tls_cacerts']));
                    var eh = client.newEventHub();
                    eh.setPeerAddr(
                        ORGS[org].peer1.events,
                        {
                            pem: Buffer.from(data).toString(),
                            'ssl-target-name-override': ORGS[org].peer1['server-hostname']
                        });
                    eh.connect();
                    //End connect
                }   

                channel.initialize()
                .then(function(nothing){
                    var tx_id = client.newTransactionID(user);

                    // Prepare chain request
                    var request = {
                        chaincodeId : chaincodeId,
                        txId: tx_id,
                        fcn: 'invoke',
                        args: argList
                    };

                    channel.sendTransactionProposal(request)
                    .then(function(results){

                        var proposalResponses = results[0];
                        var proposal = results[1];
                        var header   = results[2];
                        var all_good = true;

                        for(var i in proposalResponses) {
                            let one_good = false;
                            let proposal_response = proposalResponses[i];
                            if( proposal_response.response && proposal_response.response.status === 200) {
                                one_good = channel.verifyProposalResponse(proposal_response);
                            } 
                            all_good = all_good & one_good;
                        }

                        if (all_good) {
                        // check all the read/write sets to see if the same, verify that each peer
                        // got the same results on the proposal
                            all_good = channel.compareProposalResponseResults(proposalResponses);
                        }

                        if (all_good) {
                            // check to see if all the results match
                            var metaDataFromChaincode = proposalResponses[0].response.payload.toString('utf8')

                            var request = {
                                proposalResponses: proposalResponses,
                                proposal: proposal,
                                header: header
                            };

                            var deployId = tx_id.getTransactionID();
                            
                            eh.registerTxEvent(
                            deployId,
                            function(tx,code){

                                if (code == 'VALID' && transactionSuccess){

                                    var response = {
                                        txId : tx,
                                        response: metaDataFromChaincode
                                    }

                                    deferred.resolve(response)

                                }else{

                                    deferred.reject("Transaction failure due to failed endorsements")

                                }

                                eh.unregisterTxEvent(deployId);
                            },
                            function(err){
                                deferred.reject(err)
                                eh.unregisterTxEvent(deployId);
                            })

                            channel.sendTransaction(request)
                            .then(function(response){
                                if (response.status === 'SUCCESS') {
                                    transactionSuccess = true;
                                }else{
                                    deferred.reject("Transaction response is empty")
                                }
                            })
                            .catch(function(error){
                                deferred.reject(error)
                            })
                        }else{
                            try{

                                var error = proposalResponses[0].message.split("chaincode error (status: 500, message: ")[1];
                                var returnError = error.substring(0, error.length - 1) 
                                deferred.reject(returnError)

                            }catch(err){
                                deferred.reject()
                            }
                        }

                    })
                    .catch(function(error){
                        deferred.reject(error) 
                    })
                })
                .catch(function(err){
                    deferred.reject(err)
                })

            })
            .catch(function(err){
                deferred.reject(err)
            })

        })
        .catch(function(err){
            deferred.reject(err)
        })
        
      

    }


    return deferred.promise;
}




function connectToChannel(request) {
    
    var deferred = Q.defer();

    if(request.channel == null || request.targets == null) {
        deferred.reject("Request parameters insufficient")
    }
    else {

        var channel_name = request.channel;
        var targets = request.targets;

        try{

            hfc.addConfigFile(path.join(__dirname, './../network-config.json'));
            hfc.setConfigSetting('request-timeout', 60000);
            var ORGS = hfc.getConfigSetting('network-config');
            chainUtils.setORGS(ORGS);

            var client = new hfc();

            var channel = client.newChannel(channel_name);


            var caRootsPath = ORGS.orderer.tls_cacerts;
            let data = fs.readFileSync(path.join(__dirname, caRootsPath));
            let caroots = Buffer.from(data).toString();

            channel.addOrderer(
                client.newOrderer(
                    ORGS.orderer.url,
                    {
                        'pem': caroots,
                        'ssl-target-name-override': ORGS.orderer['server-hostname']
                    }
                )
            );

            for (let key in targets) {
                if (ORGS.hasOwnProperty(targets[key]) && typeof ORGS[targets[key]].peer1 !== 'undefined') {
                    let data = fs.readFileSync(path.join(__dirname, ORGS[targets[key]].peer1['tls_cacerts']));
                    let peer = client.newPeer(
                        ORGS[targets[key]].peer1.requests,
                        {
                            pem: Buffer.from(data).toString(),
                            'ssl-target-name-override': ORGS[targets[key]].peer1['server-hostname']
                        }
                    );

                channel.addPeer(peer);

                }
            }
                
            deferred.resolve({client,channel,ORGS})
        }
        catch(err){
            deferred.reject(err);
        }

    }    
    return deferred.promise;

};




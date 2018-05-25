
var path = require('path');
var config = require('config.json')
var user = require('./chainUser.service')
var util = require('util');
var fs = require('fs')
var Q = require('q')

var hfc = require('fabric-client');

var service = {};


service.getAdmin = getAdmin;
service.readAllFiles = readAllFiles;
service.getOrderAdminSubmitter = getOrderAdminSubmitter;
service.getSubmitter = getSubmitter;
service.setORGS = setORGS;
service.storePathForOrg = storePathForOrg;

var ORGS = null;

function setORGS(orgs){
    ORGS = orgs;
}

function storePathForOrg(org) {
    var location = config.keyStorePath;
    return location + '_' + org;
};

function getAdmin(client, userOrg) {
    var keyPath = path.join(__dirname, util.format('./../../artifacts/crypto-config/peerOrganizations/%s.example.com/users/Admin@%s.example.com/msp/keystore', userOrg, userOrg));
    var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
    var certPath = path.join(__dirname, util.format('./../../artifacts/crypto-config/peerOrganizations/%s.example.com/users/Admin@%s.example.com/msp/signcerts', userOrg, userOrg));
    var certPEM = readAllFiles(certPath)[0];

    return Promise.resolve(client.createUser({
        username: 'peer'+userOrg+'Admin',
        mspid: ORGS[userOrg].mspid,
        cryptoContent: {
            privateKeyPEM: keyPEM.toString(),
            signedCertPEM: certPEM.toString()
        }
    }));
}


function getLocalUser(client, userOrg) {

    var deferred = Q.defer();

    try{
        var keyPath = path.join(__dirname, util.format('./../../artifacts/crypto-config/peerOrganizations/%s.example.com/users/User1@%s.example.com/msp/keystore', userOrg, userOrg));
        var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
        var certPath = path.join(__dirname, util.format('./../../artifacts/crypto-config/peerOrganizations/%s.example.com/users/User1@%s.example.com/msp/signcerts', userOrg, userOrg));
        var certPEM = readAllFiles(certPath)[0];
        var user = client.createUser({
            username: 'peer'+userOrg+'User1',
            mspid: ORGS[userOrg].mspid,
            cryptoContent: {
                privateKeyPEM: keyPEM.toString(),
                signedCertPEM: certPEM.toString()
            }
        });
       
        deferred.resolve(user)

    }catch(err){
        deferred.reject(err)
    }
    

    return deferred.promise;
}

function readAllFiles(dir) {
    var files = fs.readdirSync(dir);
    var certs = [];
    files.forEach((file_name) => {
        let file_path = path.join(dir,file_name);
        let data = fs.readFileSync(file_path);
        certs.push(data);
    });
    return certs;
}

function getOrderAdminSubmitter(client){
    return getOrdererAdmin(client)
}

function getOrdererAdmin(client) {
    var keyPath = path.join(__dirname, './../../artifacts/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/msp/keystore');
    var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
    var certPath = path.join(__dirname, './../../artifacts/crypto-config/ordererOrganizations/example.com/users/Admin@example.com/msp/signcerts');
    var certPEM = readAllFiles(certPath)[0];

    return Promise.resolve(client.createUser({
        username: 'ordererAdmin',
        mspid: 'OrdererMSP',
        cryptoContent: {
            privateKeyPEM: keyPEM.toString(),
            signedCertPEM: certPEM.toString()
        }
    }));
}


function getSubmitter(client, peerOrgAdmin, org, username) {

    var deferred = Q.defer();
    hfc.newDefaultKeyValueStore({
        path: storePathForOrg(org)
    })
    .then(function(store){
        client.setStateStore(store)
        if (peerOrgAdmin) {
             deferred.resolve(getAdmin(client, org))
        } else{
            getLocalUser(client,org)
            .then(function(user1){
                if(user1 != undefined){
                    deferred.resolve(user1)
                }else{
                    deferred.reject("Wallet not found")
                } 
            })
            .catch(function(error){
                deferred.reject(error)
            })
        }
    })

    return deferred.promise;

};


module.exports = service;
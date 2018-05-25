
var caService = require('fabric-ca-client/lib/FabricCAClientImpl.js');
var User = require('fabric-client/lib/User.js');
var hfc = require('fabric-client');
var Q = require('q');
var config = require('config.json')

var service = {};

service.getUser = getUser;
service.registerUser = registerUser;
service.setORGS = setORGS;
service.enrollUser = enrollUser;

var ORGS = null;

var tlsOptions = {
    trustedRoots: [],
    verify: false
};


function setORGS(orgs){
    ORGS = orgs;
}


function getUser(username, orgName, client){
    var deferred = Q.defer();
        
        client.getUserContext(username, true)
        .then(function(user){
            if(user) {
                if(user.isEnrolled()){
                    deferred.resolve(user)
                }else{
                    deferred.resolve()
                }   
            }
            else{
                deferred.resolve()
            }           
        })
        .catch(function(err){
            deferred.reject(err)
        })

    return deferred.promise;
}


function enrollUser(username, orgname, client){

    var deferred = Q.defer();

    var caUrl = ORGS[orgname].ca.url;
    var cop = new caService(caUrl, tlsOptions, ORGS[orgname].ca.name);

    hfc.newDefaultKeyValueStore({
        path: storePathForOrg(orgname)
    })
    .then(function(store){
        client.setStateStore(store)

        var enrollRequest = {
            enrollmentID: username,
            enrollmentSecret: username
        }
      
        cop.enroll(enrollRequest)
        .then(function(message){

            var user = new User(username);

            user.setEnrollment(message.key,message.certificate,ORGS[orgname].mspid)
            .then(function(){
                client.setUserContext(user)
                .then(function(){
                    deferred.resolve(user)
                })
                .catch(function(err){
                    deferred.reject("Could not set context")
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

    return deferred.promise;

}

function registerUser(username,orgname,client){
   console.log(username+"  "+orgname+"  "+client)
   console.log(ORGS)
   console.log(ORGS[orgname])
    var deferred = Q.defer();

    var caUrl = ORGS[orgname].ca.url;
    var cop = new caService(caUrl, tlsOptions, ORGS[orgname].ca.name);
    hfc.newDefaultKeyValueStore({
        path: storePathForOrg(orgname)
    })
    .then(function(store){
        client.setStateStore(store)
        getAdminUser(client, orgname)
        .then(function(registrar){

            var request = {
                enrollmentID: username, 
                affiliation: orgname + '.department1',
                enrollmentSecret: username,
            }



            cop.register(request, registrar)
            .then(function(secret){

                var enrollRequest = {
                    enrollmentID: username,
                    enrollmentSecret: secret
                }

                cop.enroll(enrollRequest)
                .then(function(message){
                    console.log("Hyper mesage : ",message)
                    console.log("Hyper mesage Key : ",message.key);
                  
                    
                    var user = new User(username);

                    user.setEnrollment(message.key,message.certificate,ORGS[orgname].mspid)
                    .then(function(){
                        client.setUserContext(user)
                        .then(function(){
                            console.log("My check for the user : ",user)
                            user.pubKey=message.key.getPublicKey().toBytes();
                            user.priKey=message.key.toBytes();
                            deferred.resolve(user)
                        })
                        .catch(function(err){
                            deferred.reject("Could not set context")
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
            .catch(function(error){
                deferred.reject(error)
            })

        })
        .catch(function(error){
            deferred.reject(error)
        })
    })

    return deferred.promise;

}

function getAdminUser(client, userOrg) {

    var deferred = Q.defer();

    var caUrl = ORGS[userOrg].ca.url;
    var adminUser = ORGS[userOrg].ca.admin;
    var password = ORGS[userOrg].ca.password;

    getUser(adminUser, userOrg, client)
    .then(function(admin){
        if(admin != undefined){
            deferred.resolve(admin)
        }
        else{

            var request = {
                enrollmentID: adminUser,
                enrollmentSecret: password
            }

            var cop = new caService(caUrl, tlsOptions, ORGS[userOrg].ca.name);

            cop.enroll(request)
            .then(function(message){
                
                var user = new User(adminUser);

                user.setEnrollment(message.key,message.certificate,ORGS[userOrg].mspid)
                .then(function(){
                    client.setUserContext(user)
                    .then(function(){
                        deferred.resolve(user)
                    })
                    .catch(function(err){
                        deferred.reject("Could not set context")
                    })

                })
                .catch(function(error){
                    deferred.reject(error)
                })
            })
            .catch(function(err){
                deferred.reject(err)
            })
        }  
    })
    .catch(function(error){
        deferred.reject(error)
    })

    return deferred.promise;

};

function revokeUser(){
    console.log("REVOKE")
}

function storePathForOrg(org) {
    var location = config.keyStorePath;
    return location + '_' + org;
};


module.exports = service
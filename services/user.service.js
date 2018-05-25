var config = require('config.json');
var _ = require('lodash');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
var Q = require('q');
var mongo = require('mongoskin');
//var mongoUtil = require('mongoPoolUtil');
//var db = mongoUtil.getDb();
var chainUser = require('./utils/chainUser.service')
var chainUtils = require('./utils/chainUtils.service');
var db = mongo.db(config.connectionString, { native_parser: true });
var hfc = require('fabric-client');
var fs = require('fs');
var path = require('path');
var eh;
hfc.setConfigSetting('request-timeout', 60000);
hfc.addConfigFile(path.join(__dirname, './../network-config.json'));
var ORGS = hfc.getConfigSetting('network-config');
chainUser.setORGS(ORGS);
var client = new hfc();
var bcrypt = require('bcryptjs'); 
db.bind('users');

var service = {};

service.authenticate = authenticate;
service.getById = getById;
service.create = create;
//service.update = update;
service.delete = _delete;

module.exports = service;

function authenticate(username, password) {
    console.log("username and password ",username, password)
    var deferred = Q.defer();

    db.users.findOne({ username: username }, function (err, user) {
        console.log("The user data is  : ",user)
        if (err) deferred.reject(err.name + ': ' + err.message);
        if (user && bcrypt.compareSync(password, user.hash)) {
            console.log("We are a step ahead")
            // authentication successful
            if (user.isIdentityCreated == false) {
                console.log("isIdentityCreated is false")
                chainUser.registerUser(user.username, 'org1', client)
                    .then(function (blockUser) {
                        console.log("The data of blockuser pubKey : ",blockUser.pubKey)
                        console.log("The data of blockuser  priKey : ",blockUser.priKey)
                        updateUser(user._id, user.status, true, blockUser.pubKey, blockUser.priKey);
                        deferred.resolve(jwt.sign({
                            sub: user._id
                        }, config.secret));
    
                    })
                    .catch(function (err) {
                        deferred.reject("User could not be enrolled");
                    })
               
            }
        } 
        if (user.isIdentityCreated == true)  {
            console.log("My Check ")
            // authentication failed
            deferred.resolve(jwt.sign({
                sub: user._id,
            }, config.secret));
        }
       
    });

    return deferred.promise;
}

function getById(_id) {
    var deferred = Q.defer();

    db.users.findById(_id, function (err, user) {
        if (err) deferred.reject(err.name + ': ' + err.message);

        if (user) {
            // return user (without hashed password)
            deferred.resolve(_.omit(user, 'hash'));
        } else {
            // user not found
            deferred.resolve();
        }
    });

    return deferred.promise;
}

function create(userParam) {
    var deferred = Q.defer();

    // validation
    db.users.findOne(
        { username: userParam.username },
        function (err, user) {
            if (err) deferred.reject(err.name + ': ' + err.message);

            if (user) {
                // username already exists
                deferred.reject('Username "' + userParam.username + '" is already taken');
            } else {
                createUser();
            }
        });

    function createUser() {
        // set user object to userParam without the cleartext password
        var user = _.omit(userParam, 'password');

        // add hashed password to user object
        user.hash = bcrypt.hashSync(userParam.password, 10);
        user.status = config.UnconfirmedUser;
        user.cert_id = "";
        user.isIdentityCreated = false;
        db.users.insert(
            user,
            function (err, doc) {
                if (err) deferred.reject(err.name + ': ' + err.message);

                deferred.resolve();
            });
    }

    return deferred.promise;
}

// function update(_id, userParam) {
//     var deferred = Q.defer();

//     // validation
//     db.users.findById(_id, function (err, user) {
//         if (err) deferred.reject(err.name + ': ' + err.message);

//         if (user.username !== userParam.username) {
//             // username has changed so check if the new username is already taken
//             db.users.findOne(
//                 { username: userParam.username },
//                 function (err, user) {
//                     if (err) deferred.reject(err.name + ': ' + err.message);

//                     if (user) {
//                         // username already exists
//                         deferred.reject('Username "' + req.body.username + '" is already taken')
//                     } else {
//                         updateUser();
//                     }
//                 });
//         } else {
//             updateUser();
//         }
//     });

    function updateUser(id, status, identityStatus,pubKey, priKey) {
        var deferred = Q.defer();
        console.log("The data :",id+"  "+status+"  "+ identityStatus+"  "+pubKey+"  "+ priKey)
        // fields to update
        // var set = {
        //     firstName: userParam.firstName,
        //     lastName: userParam.lastName,
        //     username: userParam.username,
        // };

        var set = {
            status: status,
            isIdentityCreated: identityStatus,
            pubKey:pubKey,
            signature:priKey
        };
        db.users.update({
            _id: id
        }, {
                $set: set
            }, function (err, doc) {
                if (err) {
                    logger.error('updateUser mongo: %s', err.stack);
                    deferred.reject(err.name + ': ' + err.message);
                }
                deferred.resolve();
            });
        return deferred.promise;
}

function _delete(_id) {
    var deferred = Q.defer();

    db.users.remove(
        { _id: mongo.helper.toObjectID(_id) },
        function (err) {
            if (err) deferred.reject(err.name + ': ' + err.message);

            deferred.resolve();
        });

    return deferred.promise;
}
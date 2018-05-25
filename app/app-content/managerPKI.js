/***************************************************************************
* ©Copyright 2016 - 2017 Sopra Steria Group
*
* This file is part of Blockchain Based KYC Application (BBKYC)
*
* BBKYC is the copyright of Sopra Steria Group. You cannot copy, reuse, 
* re-distribute it for any purpose (commercial or non-commercial).
* 
* All right to distribute or use BBKYC is reserved by Sopra Steria Group
*    
* BBKYC is distributed only for the purpose of sub-contracting and all 
* modifications done to it, will be the property of Sopra Steria Group
****************************************************************************/
function GenerateRSAKeys(passPhrase, email) { 
	console.log("Called")
	// Generate RSA Key
	var myRSAkey = BSCrypt.generateKeyPair(passPhrase+email, 1024);

	var keys= {
		"privKey": myRSAkey.privKey,
		"modulus": myRSAkey.modulus,
		"pubKey": myRSAkey.pubKey
	}

	document.getElementById('pubKey').value = myRSAkey.pubKey.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "");
	sessionStorage.keys = JSON.stringify(keys)

	return true;
}

function generateCertificate(email, passPhrase){
	
	var key = BSCrypt.generateKeyPair(passPhrase+email, 1024);
	var pubKey = key.pubKey.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "")
	//var certificate = ""
	//var signature = ""
     //signature = BSCrypt.sign(certificate,key.privKey)
	document.getElementById('pubKey').value = pubKey.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "");
	document.getElementById('signature').value = key.privKey;
	document.getElementById('modulus').value = key.modulus;

	//var identityUrl = "http://172.26.50.150:3000"


	//var dataString = "{\r\n\t\"org_name\" : \"" + name + "\",\r\n\t\"org_country\" : \"" + country + "\",\r\n\t\"org_email\" : \"" + email + "\",\r\n\t\"public_key_algo\" : \"RSA\",\r\n\t\"public_key\" : \"" + pubKey + "\",\r\n\t\"role\" : \"" + role + "\"\r\n}"
	
	/*$.ajax({
      url: identityUrl + "/" + domain,
      "method": "POST",
	  "headers": { "content-type": "application/json"},
      data: dataString,
      async: false,
      success: function(data) {
      	certificate = data.cert_id
      	signature = BSCrypt.sign(certificate,key.privKey)
      	document.getElementById('pubKey').value = pubKey.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "");
		document.getElementById('signature').value = signature;
		document.getElementById('modulus').value = key.modulus;
		return true
      },
       error: function() {
         console.log("error")
         return false
      }
   });
*/
}

import fs from 'fs';
import forge from 'node-forge';

// Read the existing private key
const privateKeyPem = fs.readFileSync('./ssl/dev-key.pem', 'utf8');
const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

// Create a new certificate
const cert = forge.pki.createCertificate();
cert.publicKey = forge.pki.rsa.setPublicKey(privateKey.n, privateKey.e);
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [
  { name: 'commonName', value: 'localhost' },
  { name: 'countryName', value: 'US' },
  { shortName: 'ST', value: 'State' },
  { name: 'localityName', value: 'City' },
  { name: 'organizationName', value: 'Development' },
  { shortName: 'OU', value: 'Development' },
];

cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.setExtensions([
  { name: 'basicConstraints', cA: true },
  {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true,
  },
  { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] },
]);

// Self-sign the certificate
cert.sign(privateKey);

// Convert to PEM format
const certPem = forge.pki.certificateToPem(cert);

// Write certificate file
fs.writeFileSync('./ssl/dev-cert.pem', certPem);
console.log('Self-signed certificate generated successfully!');

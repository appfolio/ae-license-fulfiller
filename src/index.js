const path = require('path')
    , checker = require('license-checker')
    , satisfies = require('spdx-satisfies')
    , defaultLicenseTexts = require('spdx-license-list/full');

function fulfill(config = {}) {
  return new Promise((resolve, reject) => {
    const {
      acceptableLicenseFiles,
      agreedLicenses,
      customFormat = {
        licenseText: '',
      },
      ignorePackages = [],
      overrides,
      production,
      startPath = [],
      unknown,
    } = config;

    checker.init({ customFormat, production, start: startPath, unknown }, function(err, packages) {
      if (err) {
        reject(err);
        return;
      }

      let licenseFulfillments = {};

      Object.keys(packages).forEach(key => {
        const curPackage = packages[key];

        Object.assign(curPackage, overrides[key]);

        if (typeof curPackage.licenses !== 'string' || curPackage.licenses === 'UNKNOWN') {
          curPackage.agreedLicense = null;
          return;
        }

        if (! curPackage.forceAccept) {
          for (const agreedLicense of agreedLicenses) {
            try {
              if (satisfies(agreedLicense, curPackage.licenses)) {
                curPackage.agreedLicense = agreedLicense;
                break;
              }
            } catch(e) {
              curPackage.agreedLicense = null;
            }
          }

          if (! curPackage.agreedLicense) {
            curPackage.agreedLicense = null;
            return;
          }
        }

        const { agreedLicense, licenseFile } = curPackage;
        if (licenseFile) {
          const basename = path.basename(licenseFile, path.extname(licenseFile)).toUpperCase();

          if (! acceptableLicenseFiles.includes(basename)) {
            curPackage.licenseFile = null;
            curPackage.licenseText = null;
          }
        }

        if (curPackage.agreedLicense &&
            ! curPackage.licenseText &&
            defaultLicenseTexts[agreedLicense]) {
          curPackage.licenseText = defaultLicenseTexts[agreedLicense].licenseText;
        }
      });

      Object.keys(packages).forEach(nameVersionTuple => {
        const curPackage = packages[nameVersionTuple];
        const parts = nameVersionTuple.split('@');
        const name = parts.slice(0, -1).join('@');

        const { publisher = '', repository = '' } = curPackage;

        if (ignorePackages.includes(name)) {
          return;
        }

        const [version] = parts.slice(-1);
        const key = `${name}:${repository.toLowerCase()}:${curPackage.agreedLicense}`;
        if (licenseFulfillments[key]) {
          licenseFulfillments[key].versions.push(version);
          licenseFulfillments[key].licenseText = curPackage.licenseText;
        } else {
          licenseFulfillments[key] = {
            name,
            versions: [version],
            repository: repository || null,
            publisher: publisher || null,
            licenseText: curPackage.licenseText,
            agreedLicense: curPackage.agreedLicense,
          };
        }
      });

      resolve(Object.values(licenseFulfillments));
    });
  });
};

module.exports = fulfill;

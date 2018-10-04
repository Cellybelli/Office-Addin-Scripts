import * as assert from 'assert';
import * as fs from 'fs'
import * as mocha from 'mocha';
import * as manifestInfo from '../src/manifestInfo';
const uuid = require('uuid');
const manifestOriginalFolder = process.cwd() + '/test/manifests';
const manifestTestFolder = process.cwd() + '/test/testManifests'

describe('Manifest', function() {
  describe('readManifestInfo', function() {
    it('should read the manifest info', async function() {
      const info = await manifestInfo.readManifestFile('test/manifests/manifest.xml')

      assert.strictEqual(info.defaultLocale, 'en-US');
      assert.strictEqual(info.description, 'Describes this Office Add-in.');
      assert.strictEqual(info.displayName, 'Office Add-in Name');
      assert.strictEqual(info.id, '132a8a21-011a-4ceb-9336-6af8a276a288');
      assert.strictEqual(info.officeAppType, 'TaskPaneApp');
      assert.strictEqual(info.providerName, 'ProviderName');
      assert.strictEqual(info.version, '1.2.3.4');
    });
    it('should throw an error if there is a bad xml end tag', async function() {  
        let result;
        try {
          const info = await manifestInfo.readManifestFile('test/manifests/manifest.incorrect-end-tag.xml');
        } catch (err) {          
          result = err;
        };
        assert.equal(result, "Unable to parse the manifest file: test/manifests/manifest.incorrect-end-tag.xml. \nError: Unexpected close tag\nLine: 8\nColumn: 46\nChar: >");        
    });
    it('should handle a missing description', async function() {
      const info = await manifestInfo.readManifestFile('test/manifests/manifest.no-description.xml');

      assert.strictEqual(info.defaultLocale, 'en-US');
      assert.strictEqual(info.description, undefined);
      assert.strictEqual(info.displayName, 'Office Add-in Name');
      assert.strictEqual(info.id, '132a8a21-011a-4ceb-9336-6af8a276a288');
      assert.strictEqual(info.officeAppType, 'TaskPaneApp');
      assert.strictEqual(info.providerName, 'ProviderName');
      assert.strictEqual(info.version, '1.2.3.4');
    });
  });
});

describe('Manifest', function() {
  this.beforeEach(async function() {
    await _createManifestFilesFolder()
  });
  this.afterEach(async function() {
    await _deleteManifestTestFolder(manifestTestFolder);
  });
  describe('personalizeManifestFile', function() {
    it('should handle a specified valid guid and displayName', async function() { 
      let testManifest = manifestTestFolder + '/manifest.xml';

      // get original manifest info
      const originalInfo = await manifestInfo.readManifestFile(testManifest);
      
      // call personalizeManifestFile, specifying guid and displayName  parameters
      const testGuid = uuid.v1();
      const testDisplayName = 'TestDisplayName';
      const updatedInfo = await manifestInfo.personalizeManifest(testManifest, testGuid, testDisplayName);

      // verify guid displayName updated
      assert.notStrictEqual(originalInfo.id, updatedInfo.id);      
      assert.notStrictEqual(originalInfo.displayName, updatedInfo.displayName);
    });
    it('should handle specifying \'random\' form guid parameter', async function() {
      let testManifest = manifestTestFolder + '/manifest.xml';

      // get original manifest info and create copy of manifest that we can overwrite in this test
      const originalInfo = await manifestInfo.readManifestFile(testManifest);

      // call personalizeManifestFile, specifying 'random' parameter
      const updatedInfo = await manifestInfo.personalizeManifest(testManifest, 'random', undefined);
      
      // verify guid displayName updated
      assert.notStrictEqual(originalInfo.id, updatedInfo.id);      
      assert.strictEqual(originalInfo.displayName, updatedInfo.displayName);
    });
    it('should handle specifying displayName only', async function() {
      let testManifest = manifestTestFolder + '/manifest.xml';

      // get original manifest info and create copy of manifest that we can overwrite in this test
      const originalInfo = await manifestInfo.readManifestFile(testManifest);

      // call  personalizeManifestFile, specifying a displayName parameter
      const testDisplayName = 'TestDisplayName';
      const updatedInfo = await manifestInfo.personalizeManifest(testManifest, undefined, testDisplayName);

      // verify displayName updated and guid not updated
      assert.notStrictEqual(originalInfo.displayName, updatedInfo.displayName);
      assert.strictEqual(updatedInfo.displayName, testDisplayName);
      assert.strictEqual(originalInfo.id, updatedInfo.id);
    });
    it('should handle not specifying either a guid or displayName', async function() {
      let testManifest = manifestTestFolder + '/manifest.xml';
      let result;
        try {
          await manifestInfo.personalizeManifest(testManifest, undefined, undefined);
        } catch (err) {          
          result = err;
        };
        assert.equal(result, "Please provide either a guid or displayName parameter.");
    });
    it('should handle an invalid manifest file path', async function() {
      let result;
      let testManifest = manifestTestFolder + '/foo/manifest.xml';
      const testGuid = uuid.v1();
      const testDisplayName = 'TestDisplayName';
        try {
          await manifestInfo.personalizeManifest(testManifest, testGuid, testDisplayName);
        } catch (err) {          
          result = err;
        };
        assert.equal(result, "Unable to generate personalized manifest xml.");
    });
  });
});

async function _deleteManifestTestFolder(projectFolder: string) : Promise<void>
{
  if(fs.existsSync(projectFolder))
  {
    fs.readdirSync(projectFolder).forEach(function(file,index){ 
    let curPath = projectFolder + "/" + file; 
      
    if(fs.lstatSync(curPath).isDirectory()) {
      _deleteManifestTestFolder(curPath);
    }
    else {
      fs.unlinkSync(curPath);
    }
  });
  fs.rmdirSync(projectFolder);
}
}

async function _createManifestFilesFolder() : Promise<void>
{
    if (fs.existsSync(manifestTestFolder)){
      _deleteManifestTestFolder(manifestTestFolder);
  }

  let fsExtra = require('fs-extra');
  await fsExtra.copy(manifestOriginalFolder, manifestTestFolder);
}

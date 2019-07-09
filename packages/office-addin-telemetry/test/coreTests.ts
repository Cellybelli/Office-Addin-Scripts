import * as assert from 'assert';
import * as fs from "fs";
import { OfficeAddinTelemetry } from "../src/officeAddinTelemetry";
import * as appInsights from "applicationinsights";
import * as path from 'path';
import {  describe, before, it } from 'mocha';
const addInTelemetry = new OfficeAddinTelemetry("de0d9e7c-1f46-4552-bc21-4e43e489a015", "",true);
    
    describe('reportEvent', () => {
    it('should track event of object passed in with a project name', () => {
        addInTelemetry.setTelemetryOff();
        var test1 = {"Test":true};
        addInTelemetry.reportEvent("TestData",test1);
        assert(1 === addInTelemetry.getEventsSent());
    });
  });

    describe('reportError', () => {
    it('should send telemetry execption', () => {
        addInTelemetry.setTelemetryOff();
        const exception = new Error("this error contains a file path: C://Users//t-juflor//AppData//Roaming//npm//node_modules//balanced-match//index.js");
        addInTelemetry.reportError("ReportErrorCheck",exception);
        assert(1 === addInTelemetry.getExceptionsSent());
    });
  });

    describe('addTelemetry', () => {
        	it('should add object to telemetry', () => {
            	var test ={};
            	addInTelemetry.addTelemetry(test, "Test", true);
            	assert(JSON.stringify(test) === JSON.stringify({"Test": true }));
        	});
          });

    describe('checkPrompt', () => {
      const path = require('os').homedir()+ "/AppData/Local/Temp/check.txt";
          it('should check to see if it has writen to a file if not creates file and writes to it returns true', () => {
            if(fs.existsSync(path)){
            fs.unlinkSync(path)//deletes file
          }
          assert(true === addInTelemetry.checkPrompt());

          });

        
          it('should check to see if text is in file, if appropriate word is in, returns false', () => {

          assert(false === addInTelemetry.checkPrompt());

          if(fs.existsSync(path)){
            fs.unlinkSync(path)//deletes file
          }

          });

          it('should check to see if text is in file if already created, if appropriate word is not in, returns true and writes to file', () => {

          fs.writeFileSync(path, "");

          assert(true === addInTelemetry.checkPrompt());
          var text = fs.readFileSync(path,"utf8");
          if (text.includes('de0d9e7c-1f46-4552-bc21-4e43e489a015')){
            var response = true;
          }else{
            response = false;
          }

          assert(true === response);

          if(fs.existsSync(path)){
            fs.unlinkSync(path)//deletes file
          }

          });
        });
    describe('telemetryOptIn', () => {//Almost done
        	it('should display user asking to opt in, changes to true if user types y ', () => {
                addInTelemetry.telemetryOptIn(1);
                assert(true === addInTelemetry.telemetryOptedIn2());
          });
          it('should display user asking to opt in, changes to false if user types anything else then y ', () => {
            addInTelemetry.telemetryOptIn(2);
            assert(false === addInTelemetry.telemetryOptedIn2());
      });
          });


    describe('setTelemetryOff', () => {
        	it('should change samplingPercentage to 100, turns telemetry on', () => {
            	addInTelemetry.setTelemetryOn();
            	addInTelemetry.setTelemetryOff();
            	assert(0 === appInsights.defaultClient.config.samplingPercentage);
        	});
          });
          
    describe('setTelemetryOn', () => {
        	it('should change samplingPercentage to 100, turns telemetry on', () => {
            	addInTelemetry.setTelemetryOff();
            	addInTelemetry.setTelemetryOn();
            	assert(100 === appInsights.defaultClient.config.samplingPercentage);
        	});
          });
    describe('isTelemetryOn', () => {
        	it('should return true if samplingPercentage is on(100)', () => {
              appInsights.defaultClient.config.samplingPercentage = 100;
            	assert(true === addInTelemetry.isTelemetryOn());
          });
          
        	it('should return false if samplingPercentage is off(0)', () => {
              appInsights.defaultClient.config.samplingPercentage = 0;
            	assert(false === addInTelemetry.isTelemetryOn());
        	});
        });
        
 	describe('getTelemtryKey', () => {
        	it('should return telemetry key', () => {
            	assert('de0d9e7c-1f46-4552-bc21-4e43e489a015' === addInTelemetry.getTelemtryKey());
        	});
          });

    describe('getEventsSent', () => {
        	it('should return amount of events successfully sent', () => {
                addInTelemetry.setTelemetryOff();
                var test1 = {"Test":true};
                addInTelemetry.reportEvent("TestData",test1);
                console.log(addInTelemetry.getEventsSent());
                assert(1 === addInTelemetry.getEventsSent());
        	});
          });

    describe('getExceptionsSent', () => {
        	it('should return amount of exceptions successfully sent ',() => {
                addInTelemetry.setTelemetryOff();
                const exception = new Error("this error contains a file path: C://Users//t-juflor//AppData//Roaming//npm//node_modules//balanced-match//index.js");
                addInTelemetry.reportError("TestData",exception);
                console.log(addInTelemetry.getExceptionsSent());
                assert(1 === addInTelemetry.getExceptionsSent());
            });
          });

    describe('telemetryOptedIn', () => {//could be connected with telemetryOptIn
        	it('should return true if user opted in', () => {
            addInTelemetry.telemetryOptIn(1);
            assert(true === addInTelemetry.telemetryOptedIn2());
                
          });
          it('should return false if user opted out', () => {
            addInTelemetry.telemetryOptIn(2);
            assert(false === addInTelemetry.telemetryOptedIn2());
        	});
          });

   describe('parseErrors', () => {//TO DO
            it('should return a parsed file path error',() => {
                  addInTelemetry.setTelemetryOff();
                  var exceptionObject = {};
                  var err = new Error("this error contains a file path: C://Users//t-juflor//AppData//Roaming//npm//node_modules//balanced-match//index.js");
                  var compare = new Error('this error contains a file path: C:index.js');
                  compare.stack = "";
                  compare.message = "this error contains a file path: C:index.js"
                  this.addTelemetry(exceptionObject, "EventName", "Tester");
  	              this.addTelemetry(exceptionObject, "Message", err.message);
  	              this.addTelemetry(exceptionObject, "Stack", err.stack);
                  addInTelemetry.parseException2(exceptionObject)
                  console.log(JSON.stringify(exceptionObject));
                  assert(compare ===  addInTelemetry.parseException2(exceptionObject));
              });
            });*/




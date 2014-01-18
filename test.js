var async = require('async');

var NodeSensor = require('./index');

NodeSensor.discover(function(nodeSensor) {
  console.log('found NODE sensor ' + nodeSensor.toString());

  var hasLuma         = false;
  var hasClima        = false;
  var hasTherma       = false;
  var hasOxa          = false;
  var hasChroma       = false;
  var hasBarCode      = false;
  var hasThermocouple = false;

  var oxaModule;
  var hasOxaCO        = false;

  nodeSensor.on('disconnect', function() {
    console.log('disconnected!');
    process.exit(0);
  });

  nodeSensor.on('buttonPush', function() {
    console.log('button push');
  });

  nodeSensor.on('buttonRelease', function() {
    console.log('button release');
  });

  async.series([
    function(callback) {
      console.log('connect');
      nodeSensor.connect(callback);
    },
    function(callback) {
      console.log('discoverServicesAndCharacteristics');
      nodeSensor.discoverServicesAndCharacteristics(callback);
    },
    function(callback) {
      console.log('setup');
      nodeSensor.setup(callback);
    },
    function(callback) {
      console.log('readDeviceName');
      nodeSensor.readDeviceName(function(deviceName) {
        console.log('\tdevice name = ' + deviceName);
        callback();
      });
    },
    function(callback) {
      console.log('readVersion');
      nodeSensor.readVersion(function(firmware, model) {
        console.log('\tfirmware = ' + firmware);
        console.log('\tmodel    = ' + model);
        callback();
      });
    },
    function(callback) {
      console.log('readStatus');
      nodeSensor.readStatus(function(batteryLevel, moduleA, moduleB) {
        console.log('\tbatteryLevel = ' + batteryLevel.toFixed(1) + ' V');
        console.log('\tmodule A     = ' + moduleA);
        console.log('\tmodule B     = ' + moduleB);

        hasLuma         = (moduleA === 'Luma')         || (moduleB === 'Luma');
        hasClima        = (moduleA === 'Clima')        || (moduleB === 'Clima');
        hasTherma       = (moduleA === 'Therma')       || (moduleB === 'Therma');
        hasOxa          = (moduleA === 'Oxa')          || (moduleB === 'Oxa');
        hasChroma       = (moduleA === 'Chroma')       || (moduleB === 'Chroma');
        hasBarCode      = (moduleA === 'BarCode')      || (moduleB === 'BarCode');
        hasThermocouple = (moduleA === 'Thermocouple') || (moduleB === 'Thermocouple');

        if (hasOxa) {
          oxaModule = (moduleA === 'Oxa') ? 'A' : 'B';
        }

        callback();
      });
    },
    function(callback) {
      console.log('readModuleSubtypes');
      nodeSensor.readModuleSubtypes(function(moduleASubtype, moduleBSubtype) {
        console.log('\tmodule A subtype = ' + moduleASubtype);
        console.log('\tmodule B subtype = ' + moduleBSubtype);

        if (hasOxa) {
          hasOxaCO = (moduleASubtype === 'CO') || (moduleBSubtype === 'CO');
        }

        callback();
      });
    },
    function(callback) {
      console.log('readSerials');
      nodeSensor.readSerials(function(core, moduleA, moduleB) {
        console.log('\tcore serial     = ' + core);
        console.log('\tmodule A serial = ' + moduleA);
        console.log('\tmodule B serial = ' + moduleB);
        callback();
      });
    },
    function(callback) {
      console.log('readModuleVersions');
      nodeSensor.readModuleVersions(function(moduleAVersion, moduleBVersion) {
        console.log('\tmodule A version = ' + moduleAVersion);
        console.log('\tmodule B version = ' + moduleBVersion);

        callback();
      });
    },
    function(callback) {
      console.log('readQuietMode');
      nodeSensor.readQuietMode(function(on) {
        console.log('\tquiet mode = ' + on); 

        callback();
      });
    },
    function(callback) {
      nodeSensor.on('koreAccelerometerReading', function(x, y, z) {
        console.log('\t* Kore accelerometer reading ' + x.toFixed(1) + ', ' + y.toFixed(1) + ', ' + z.toFixed(1) + ' G');
      });

      nodeSensor.on('koreGyroscopeReading', function(x, y, z) {
        console.log('\t* Kore gyroscope reading     ' + x.toFixed(1) + ', ' + y.toFixed(1) + ', ' + z.toFixed(1) + ' °/s');
      });

      nodeSensor.on('koreMagnetometerReading', function(x, y, z) {
        console.log('\t* Kore magnetometer reading  ' + x.toFixed(1) + ', ' + y.toFixed(1) + ', ' + z.toFixed(1) + ' G');
      });
      async.series([
        function(callback) {
          console.log('writeKoreMode true true true 100');
          nodeSensor.writeKoreMode(true, true, true, 100, function() {
            setTimeout(callback, 1000);
          });
        },
        function(callback) {
          console.log('writeKoreMode false false false 10');
          nodeSensor.writeKoreMode(false, false, false, 100, callback);
        },
        function() {
          callback();
        }
      ]);
    },
    function(callback) {
      if (hasLuma) {
        async.series([
          function(callback) {
            console.log('writeLumaMode 255');
            nodeSensor.writeLumaMode(255, function() {
              setTimeout(callback, 1000);
            });
          },
          function(callback) {
            console.log('writeLumaStrobe 1 Hz');
            nodeSensor.writeLumaStrobe(1, function() {
              setTimeout(callback, 5000);
            });
          },
          function(callback) {
            console.log('writeLumaStrobe 0');
            nodeSensor.writeLumaStrobe(0, function() {
              console.log('writeLumaMode 0');
              nodeSensor.writeLumaMode(0, function() {
                setTimeout(callback, 1000);
              });
            });
          },
          function() {
            callback();
          }
        ]);
      } else {
        console.log('No Luma');
        callback();
      }
    },
    function(callback) {
      if (hasClima) {
        nodeSensor.on('climaTemperatureReading', function(temperature) {
          console.log('\t* Clima temperature reading ' + temperature.toFixed(1) + ' °C');
        });

        nodeSensor.on('climaPressureReading', function(pressure) {
          console.log('\t* Clima pressure reading    ' + pressure.toFixed(1) + ' kPa');
        });

        nodeSensor.on('climaHumidityReading', function(humidity) {
          console.log('\t* Clima humidity reading    ' + humidity.toFixed(1) + ' %');
        });

        nodeSensor.on('climaLightReading', function(light) {
          console.log('\t* Clima light reading       ' + light.toFixed(1) + ' lx');
        });

        async.series([
          function(callback) {
            console.log('writeClimaMode true true true 10');
            nodeSensor.writeClimaMode(true, true, true, 10, function() {
              setTimeout(callback, 1000);
            });
          },
          function(callback) {
            console.log('writeClimaMode false false false 10');
            nodeSensor.writeClimaMode(false, false, false, 10, callback);
          },
          function() {
            callback();
          }
        ]);
      } else {
        console.log('No Clima');
        callback();
      }
    },
    function(callback) {
      if (hasTherma) {
        nodeSensor.on('thermaTemperatureReading', function(temperature) {
          console.log('\t* Therma temperature reading ' + temperature.toFixed(1) + ' °C');
        });

        async.series([
          function(callback) {
            console.log('writeThermaMode true true 10');
            nodeSensor.writeThermaMode(true, true, 10, function() {
              setTimeout(callback, 1000);
            });
          },
          function(callback) {
            console.log('writeThermaMode true false 10');
            nodeSensor.writeThermaMode(true, false, 10, function() {
              setTimeout(callback, 1000);
            });
          },
          function(callback) {
            console.log('writeThermaMode false false 10');
            nodeSensor.writeThermaMode(false, false, 10, callback);
          },
          function() {
            callback();
          }
        ]);
      } else {
        console.log('No Therma');
        callback();
      }
    },
    function(callback) {
      if (hasOxa) {
        nodeSensor.on('oxaReading', function(reading) {
          console.log('\t* Oxa reading ' + reading + ' ppm');
        });

        async.series([
          function(callback) {
            console.log('readOxaBaseline ' + oxaModule);
            nodeSensor.readOxaBaseline(oxaModule, function(baseline) {
              console.log('\tbaseline = ' + baseline.toFixed(6));

              callback();
            });
          },
          function(callback) {
            if (hasOxaCO) {
              async.series([
                function(callback) {
                  console.log('writeOxaCOMode true 100');
                  nodeSensor.writeOxaCOMode(true, 100, function() {
                    setTimeout(callback, 1000);
                  });
                },
                function(callback) {
                  console.log('writeOxaCOMode false 100');
                  nodeSensor.writeOxaCOMode(false, 100, callback);
                },
                function() {
                  callback();
                }
              ]);
            } else {
              console.log('No Oxa CO');
            }
          },
          function() {
            callback();
          }
        ]);
      } else {
        console.log('No Oxa');
        callback();
      }
    },
    // function(callback) {
    //   if (hasChroma) {
    //     console.log('readChroma');
    //     nodeSensor.readChroma(function(clear, red, green, blue, temperature) {
    //       console.log('\tclear       = ' + clear);
    //       console.log('\tred         = ' + red);
    //       console.log('\tgreen       = ' + green);
    //       console.log('\tblue        = ' + blue);
    //       console.log('\ttemperature = ' + temperature.toFixed(1));
    //       callback();
    //     });
    //   } else {
    //     console.log('No Chroma');
    //     callback();
    //   }
    // },
    function(callback) {
      if (hasBarCode) {
        nodeSensor.on('barCodeReading', function(barCode) {
          console.log('\t* BarCode reading ' + barCode);
        });

        console.log('press button and scan barcode');
        setTimeout(callback, 30 * 1000);
      } else {
        console.log('No BarCode');
        callback();
      }
    },
    function(callback) {
      if (hasThermocouple) {
        nodeSensor.on('thermocoupleTemperatureReading', function(temperature) {
          console.log('\t* Thermocouple temperature reading ' + temperature.toFixed(1) + ' °C');
        });

        async.series([
          function(callback) {
            console.log('writeThermocoupleMode true 10');
            nodeSensor.writeThermocoupleMode(true, 10, function() {
              setTimeout(callback, 2000);
            });
          },
          function(callback) {
            console.log('writeThermocoupleMode false 10');
            nodeSensor.writeThermocoupleMode(false, 10, callback);
          },
          function() {
            callback();
          }
        ]);
      } else {
        console.log('No Thermocouple');
        callback();
      }
    },
    function(callback) {
      console.log('disconnect');
      nodeSensor.disconnect(callback);
    }
  ]);
});

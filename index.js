var events = require('events');
var util = require('util');

var noble = require('noble');

var SERVICE_UUID                            = 'da2b84f1627948debdc0afbea0226079';

var DEVICE_NAME_UUID                        = '2a00';

var SERVICE_1_UUID                          = 'a87988b9694c479c900e95dfa6c00a24';
var COMMAND_UUID                            = 'bf03260c72054c25af4393b1c299d159';
var SERVICE_4_UUID                          = '18cda7844bd3437085bbbfed91ec86af';
var SERVICE_6_UUID                          = 'fdd6b4d3046d4330bdec1fd0c90cb43b';

function NodeSensor(peripheral) {
  this._peripheral = peripheral;
  this._services = {};
  this._characteristics = {};

  this.name = peripheral.advertisement.localName;
  this.uuid = peripheral.uuid;

  this._peripheral.on('disconnect', this.onDisconnect.bind(this));
}

util.inherits(NodeSensor, events.EventEmitter);

NodeSensor.discover = function(callback) {
  var startScanningOnPowerOn = function() {
    if (noble.state === 'poweredOn') {
      var onDiscover = function(peripheral) {
        noble.removeListener('discover', onDiscover);

        noble.stopScanning();

        var nodeSensor = new NodeSensor(peripheral);

        callback(nodeSensor);
      };

      noble.on('discover', onDiscover);

      noble.startScanning([SERVICE_UUID]);
    } else {
      noble.once('stateChange', startScanningOnPowerOn);
    }
  };

  startScanningOnPowerOn();
};

NodeSensor.prototype.onDisconnect = function() {
  this.emit('disconnect');
};

NodeSensor.prototype.onConnect = function() {
  this.emit('connect');
};

NodeSensor.prototype.toString = function() {
  return JSON.stringify({
    uuid: this.uuid,
    name: this.name
  });
};

NodeSensor.prototype.connect = function(callback) {
  this._peripheral.connect(function() {
    callback();
  });
};

NodeSensor.prototype.disconnect = function(callback) {
  this._peripheral.disconnect(callback);
};

NodeSensor.prototype.discoverServicesAndCharacteristics = function(callback) {
  this._peripheral.discoverAllServicesAndCharacteristics(function(error, services, characteristics) {
    if (error === null) {
      for (var i in services) {
        var service = services[i];
        this._services[service.uuid] = service;
      }

      for (var j in characteristics) {
        var characteristic = characteristics[j];

        this._characteristics[characteristic.uuid] = characteristic;
      }
    }

    callback();
  }.bind(this));
};

NodeSensor.prototype.readDataCharacteristic = function(uuid, callback) {
  this._characteristics[uuid].read(function(error, data) {
    callback(data);
  });
};

NodeSensor.prototype.writeDataCharacteristic = function(uuid, data, callback) {
  this._characteristics[uuid].write(data, false, function(error) {
    if (callback) {
      callback();
    }
  });
};

NodeSensor.prototype.notifyCharacteristic = function(uuid, notify, listener, callback) {
  var characteristic = this._characteristics[uuid];

  characteristic.notify(notify, function(state) {
    if (notify) {
      characteristic.addListener('read', listener);
    } else {
      characteristic.removeListener('read', listener);
    }

    callback();
  });
};

NodeSensor.prototype.readStringCharacteristic = function(uuid, callback) {
  this.readDataCharacteristic(uuid, function(data) {
    callback(data.toString());
  });
};

NodeSensor.prototype.readDeviceName = function(callback) {
  this.readStringCharacteristic(DEVICE_NAME_UUID, callback);
};

NodeSensor.prototype.setup = function(callback) {
  this.notifyCharacteristic(SERVICE_6_UUID, true, this.onService6Notify.bind(this), function() {
    this.notifyCharacteristic(SERVICE_4_UUID, true, this.onService4Notify.bind(this), function() {
      this.readService6(function(data) {
        this.writeService1(new Buffer('01', 'hex'), function() {
          this.writeService1(new Buffer('01', 'hex'), function() {
            this.readService1(function(data) {
              this.readService1(function(data) {
                callback();
              }.bind(this));
            }.bind(this));
          }.bind(this));
        }.bind(this));
      }.bind(this));
    }.bind(this));
  }.bind(this));
};

NodeSensor.prototype.readService1 = function(callback) {
  this.readDataCharacteristic(SERVICE_1_UUID, callback);
};

NodeSensor.prototype.writeService1 = function(data, callback) {
  this.writeDataCharacteristic(SERVICE_1_UUID, data, callback);
};

NodeSensor.prototype.writeCommand = function(command, callback) {
  this.writeDataCharacteristic(COMMAND_UUID, new Buffer('$' + command + '$'), callback);
};

NodeSensor.prototype.onService4Notify = function(data) {
  console.log('service 4 notify ' + data.toString('hex'));

  // TODO: buffer notify data and check length
  var type = data[0];
  var subtype = data[1];
  
  data = data.slice(2);

  switch (type) {
    case 0x01:
      var dataOffset = 0;

      if (subtype & 0x01) {
        var accelerometerX = data.readInt16BE(0 + dataOffset) / 32767.0 * 8;
        var accelerometerY = data.readInt16BE(2 + dataOffset) / 32767.0 * 8;
        var accelerometerZ = data.readInt16BE(4 + dataOffset) / 32767.0 * 8;

        this.emit('koreAccelerometerReading', accelerometerX, accelerometerY, accelerometerZ);

        dataOffset += 6;
      }

      if (subtype & 0x02) {
        var gyroscopeX = data.readInt16BE(0 + dataOffset) / 32767.0 * 2000;
        var gyroscopeY = data.readInt16BE(2 + dataOffset) / 32767.0 * 2000;
        var gyroscopeZ = data.readInt16BE(4 + dataOffset) / 32767.0 * 2000;

        this.emit('koreGyroscopeReading', gyroscopeX, gyroscopeY, gyroscopeZ);

        dataOffset += 6;
      }

      if (subtype & 0x04) {
        var magnetometerX = data.readInt16BE(0 + dataOffset) / 980.0;
        var magnetometerY = data.readInt16BE(2 + dataOffset) / 980.0;
        var magnetometerZ = data.readInt16BE(4 + dataOffset) / 1100.0;

        this.emit('koreMagnetometerReading', magnetometerX, magnetometerY, magnetometerZ);

        dataOffset += 6;
      }
      break;

    case 0x03:
      var irTemperature = data.readFloatLE(0);

      this.emit('thermaTemperatureReading', irTemperature);
      break;

    case 0x04:
      switch (subtype) {
        case 0x00:
          var temperature = data.readInt32LE(0) / 10.0;
          var pressure = data.readInt32LE(4) / 10000.0;

          this.emit('climaTemperatureReading', temperature);
          this.emit('climaPressureReading', pressure);
          break;

        case 0x01:
          var humidity = data.readInt16LE(0) / 10.0;

          this.emit('climaHumidityReading', humidity);
          break;

        case 0x03:
          var light = data.readFloatLE(0);

          this.emit('climaLightReading', light);
          break;
      }
      break;

    case 0x05:
      switch (subtype) {
        case 0x00:
          var MODULE_MAPPER = {
            0xff: 'None',
            0x00: 'Luma',
            0x01: 'Clima',
            0x02: 'Therma',
            0x03: 'Oxa',
            0x04: 'Chroma',
            0x05: 'ArrTherma',
            0x06: 'GPS',
            0x07: 'Thermocouple',
            0x08: 'ClimaPro',
            0x09: 'BarCode',
            0x0a: 'IO'
          };

          var batteryLevel = data.readFloatLE(0);
          var moduleA = MODULE_MAPPER[data[6]] || 'Unknown';
          var moduleB = MODULE_MAPPER[data[7]] || 'Unknown';

          this.emit('status', batteryLevel, moduleA, moduleB);
          break;

        case 0x05:
          this.emit('buttonPush');
          break;

        case 0x06:
          this.emit('buttonRelease');
          break;

        case 0x09:
          var serialType = {
            0x00: 'Core',
            0x01: 'ModuleA',
            0x02: 'ModuleB'
          }[data[0]];

          var serial = data.slice(1).toString('hex');

          if (serialType) {
            this.emit('serial' + serialType, serial);
          }
          break;

        case 0x0a:
          var moduleAVersion = data[0];
          var moduleBVersion = data[1];

          this.emit('moduleVersions', moduleAVersion, moduleBVersion);
          break;

        case 0x11:
          var quietMode = data[0] ? true : false;

          this.emit('quietMode', quietMode);
          break;

        case 0x012:
          var firmware = data[0] + '.' + data[1];
          var model = data.slice(4).toString();

          this.emit('version', firmware, model);
          break;
      }
      break;

    case 0x06:
      switch (subtype) {
        case 0x00:
          var clear = 0; //data[4];
          var red = 0; //data[5];
          var green = 0; //data[6];
          var blue = 0; //data[7];

          var temp = 0; //data.readFloatBE(11);

          this.emit('chromaReading', clear, red, green, blue, temp);
          break;
      }
      break;

    case 0x09:
      switch (subtype) {
        case 0x00:
          var thermocouplTemperature = data.readFloatLE(0) / 100.0;

          this.emit('thermocoupleTemperatureReading', thermocouplTemperature);
          break;
      }
      break;

    case 0x0c:
      switch (subtype) {
        case 0x0c:
          var barCode = data.toString();

          this.emit('barCodeReading', barCode);
          break;
      }
      break;
  }
};

NodeSensor.prototype.onService6Notify = function(data) {
  console.log('service 6 notify ' + data.toString('hex'));
};

NodeSensor.prototype.readService6 = function(callback) {
  this.readDataCharacteristic(SERVICE_6_UUID, callback);
};

NodeSensor.prototype.readVersion = function(callback) {
  this.once('version', callback);

  this.writeCommand('VER');
};

NodeSensor.prototype.readStatus = function(callback) {
  this.once('status', callback);

  this.writeCommand('STAT');
};

NodeSensor.prototype.readModuleVersions = function(callback) {
  this.once('moduleVersions', callback);

  this.writeCommand('STATMODVER');
};

NodeSensor.prototype.readQuietMode = function(callback) {
  this.once('quietMode', callback);

  this.writeCommand('QM?');
};

NodeSensor.prototype.writeQuietMode = function(on, callback) {
  this.once('quietMode', callback);

  this.writeCommand('QM,' + (on ? '1' : '0'));
};

NodeSensor.prototype.readSerials = function(callback) {
  this.once('serialCore', function(serialCore) {
    this.once('serialModuleA', function(serialModuleA) {
      this.once('serialModuleB', function(serialModuleB) {
        callback(serialCore, serialModuleA, serialModuleB);
      }.bind(this));
    }.bind(this));
  }.bind(this));

  this.writeCommand('SER');
};

NodeSensor.prototype.writeKoreMode = function(accelerometer, gyroscope, magnetometer, period, callback) {
  this.writeCommand(
    'KORE,' +
    (accelerometer ? '1' : '0') + ',' +
    (gyroscope ? '1' : '0') + ',' +
    (magnetometer ? '1' : '0') + ',' +
    Math.round(period / 10) + ',' +
    '0',
    callback
  );
};

NodeSensor.prototype.writeLumaMode = function(mode, callback) { // mode 0 - 255, 1 bit per LED
  this.writeCommand('LUMA,' + mode, callback);
};

NodeSensor.prototype.writeLumaStrobe = function(strobe, callback) {
  this.writeCommand('LUMASTROBE,' + strobe.toFixed(1), callback);
};

NodeSensor.prototype.writeClimaMode = function(temperaturePressure, humidity, lightProximity, period, callback) {
  this.writeCommand(
    'CLIMA,' +
    (temperaturePressure ? '1' : '0') + ',' +
    (humidity ? '1' : '0') + ',' +
    (lightProximity ? '1' : '0') + ',' +
    Math.round(period / 10) + ',' +
    '0',
    callback
  );
};

NodeSensor.prototype.writeThermaMode = function(ir, led, period, callback) {
  this.writeCommand(
    'IRTHRM,' +
    (ir ? '1' : '0') + ',' +
    (led ? '1' : '0') + ',' +
    Math.round(period / 10) + ',' +
    '0',
    callback
  );
};

NodeSensor.prototype.readChroma = function(callback) {
  this.once('chromaReading', callback);

  this.writeCommand('VERA,255,3,0,120'); // version 1: this.writeCommand('VERA,255,1,1,2');
};

NodeSensor.prototype.writeThermaMode = function(ir, led, period, callback) {
  this.writeCommand(
    'IRTHRM,' +
    (ir ? '1' : '0') + ',' +
    (led ? '1' : '0') + ',' +
    Math.round(period / 10) + ',' +
    '0',
    callback
  );
};

NodeSensor.prototype.writeThermocoupleMode = function(enabled, period, callback) {
  this.writeCommand(
    'TCPL,' +
    (enabled ? '1' : '0') + ',' +
    Math.round(period / 10) + ',' +
    '0',
    callback
  );
};

// TCPL enable,period,lifetime
// BARC,1$
// // 
// IO_INIT_UART,%d,%d$
// IO_UART,%02d,
// UART Message for IO Module: 
// IO_PD$
// IO_INIT_PINS,%02X,%02X$
// IO_PIN,%02X,%02X$
// IO_PIN,00,00$
// IO_A2D,0$
// IO_A2D,1$
// IO_STREAM,%d,%d,%d$

module.exports = NodeSensor;

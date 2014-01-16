var events = require('events');
var util = require('util');

var debug = require('debug')('node-sensor');

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

  this._responseBuffer = new Buffer(0);

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

// Table of: type, subtype: size, parser method
var responseHandlers = {
  0x01: {
    0x01: [8,  'parseKoreReading'],
    0x02: [8,  'parseKoreReading'],
    0x03: [14, 'parseKoreReading'],
    0x04: [8,  'parseKoreReading'],
    0x05: [14, 'parseKoreReading'],
    0x06: [14, 'parseKoreReading'],
    0x07: [20, 'parseKoreReading'],
  },
  0x03: {
    0x03: [6, 'parseThermaReading']
  },
  0x04: {
    0x00: [10, 'parseClimaTemperaturePressure'],
    0x01: [4,  'parseClimaHumidity'],
    0x03: [6,  'parseClimaLight']
  },
  0x05: {
    0x00: [6, 'parseBatteryLevel'],
    0x05: [3, 'parseButtonPush'],
    0x06: [3, 'parseButtonRelease'],
    0x07: [4, 'parseModuleTypes'],
    0x09: [9, 'parseSerial'],
    0x0a: [4, 'parseModuleVersions'],
    0x11: [3, 'parseQuietMode'],
    0x12: [4, 'parseFirmwareVersion'],
    0x20: [6, 'parseModel']
  },
  0x06: {
    0x00: [10, 'parseChromaReading'],
    0x02: [6,  'parseChromaTemperatureReading']
  },
  0x09: {
    0x00: [6, 'parseThermocoupleReading']
  },
  0x0c: {
    0x0c: [15, 'parseBarCodeReading']
  }
};

NodeSensor.prototype.onService4Notify = function(data) {
  debug('service 4 notify ' + data.toString('hex'));

  this._responseBuffer = Buffer.concat([this._responseBuffer, data]);

  var parsed;

  do {
    var type = this._responseBuffer[0];
    var subtype = this._responseBuffer[1];

    data = this._responseBuffer.slice(2);

    parsed = false;

    if (responseHandlers[type] && responseHandlers[type][subtype]) {
      var size       = responseHandlers[type][subtype][0];
      var methodName = responseHandlers[type][subtype][1];

      if (this._responseBuffer.length >= size) {
        this[methodName](type, subtype, data);

        parsed = true;
        this._responseBuffer = this._responseBuffer.slice(size);
      }
    }
  } while(parsed && this._responseBuffer.length);
};

NodeSensor.prototype.onService6Notify = function(data) {
  debug('service 6 notify ' + data.toString('hex'));
};

NodeSensor.prototype.readService6 = function(callback) {
  this.readDataCharacteristic(SERVICE_6_UUID, callback);
};

NodeSensor.prototype.readVersion = function(callback) {
  this.once('firmwareVersion', function(firmwareVersion) {
    this.once('model', function(model) {
      callback(firmwareVersion, model);
    }.bind(this));
  }.bind(this));

  this.writeCommand('VER');
};

NodeSensor.prototype.parseFirmwareVersion = function(type, subtype, data) {
  var firmwareVersion = data[0] + '.' + data[1];

  this.emit('firmwareVersion', firmwareVersion);
};

NodeSensor.prototype.parseModel = function(type, subtype, data) {
  var model = data.toString();

  this.emit('model', model);
};

NodeSensor.prototype.readStatus = function(callback) {
  this.once('batteryLevel', function(batteryLevel) {
    this.once('moduleTypes', function(moduleA, moduleB) {
      callback(batteryLevel, moduleA, moduleB);
    }.bind(this));
  }.bind(this));

  this.writeCommand('STAT');
};

NodeSensor.prototype.parseBatteryLevel = function(type, subtype, data) {
  var batteryLevel = data.readFloatLE(0); // 3.7 - 4.2 volts

  this.emit('batteryLevel', batteryLevel);
};

NodeSensor.prototype.parseModuleTypes = function(type, subtype, data) {
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

  var moduleA = MODULE_MAPPER[data[0]] || 'Unknown';
  var moduleB = MODULE_MAPPER[data[1]] || 'Unknown';

  this.emit('moduleTypes', moduleA, moduleB);
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

NodeSensor.prototype.parseSerial = function(type, subtype, data) {
  var serialType = {
    0x00: 'Core',
    0x01: 'ModuleA',
    0x02: 'ModuleB'
  }[data[0]];

  var serial = data.slice(1).toString('hex');

  if (serialType) {
    this.emit('serial' + serialType, serial);
  }
};

NodeSensor.prototype.readModuleVersions = function(callback) {
  this.once('moduleVersions', callback);

  this.writeCommand('STATMODVER');
};

NodeSensor.prototype.parseModuleVersions = function(type, subtype, data) {
  var moduleAVersion = data[0];
  var moduleBVersion = data[1];

  this.emit('moduleVersions', moduleAVersion, moduleBVersion);
};

NodeSensor.prototype.readQuietMode = function(callback) {
  this.once('quietMode', callback);

  this.writeCommand('QM?');
};

NodeSensor.prototype.parseQuietMode = function(type, subtype, data) {
  var quietMode = data[0] ? true : false;

  this.emit('quietMode', quietMode);
};

NodeSensor.prototype.writeQuietMode = function(on, callback) {
  this.once('quietMode', callback);

  this.writeCommand('QM,' + (on ? '1' : '0'));
};

NodeSensor.prototype.parseButtonPush = function(type, subtype, data) {
  this.emit('buttonPush');
};

NodeSensor.prototype.parseButtonRelease = function(type, subtype, data) {
  this.emit('buttonRelease');
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

NodeSensor.prototype.parseKoreReading = function(type, subtype, data) {
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

NodeSensor.prototype.parseClimaTemperaturePressure = function(type, subtype, data) {
  var temperature = data.readInt32LE(0) / 10.0;
  var pressure = data.readInt32LE(4) / 10000.0;

  this.emit('climaTemperatureReading', temperature);
  this.emit('climaPressureReading', pressure);
};

NodeSensor.prototype.parseClimaHumidity = function(type, subtype, data) {
  var humidity = data.readInt16LE(0) / 10.0;

  this.emit('climaHumidityReading', humidity);
};

NodeSensor.prototype.parseClimaLight = function(type, subtype, data) {
  var light = data.readFloatLE(0);

  this.emit('climaLightReading', light);
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
  this.once('chromaReading', function(clear, red, green, blue) {
    this.once('chromaTemperatureReading', function(temperature) {
      callback(clear, red, green, blue, temperature);
    }.bind(this));
  }.bind(this));

  this.writeCommand('VERA,255,3,0,120'); // version 1: this.writeCommand('VERA,255,1,1,2');
};

NodeSensor.prototype.parseChromaReading = function(type, subtype, data) {
  // TODO: is this right?
  var clear = data[0];
  var red   = data[1];
  var green = data[2];
  var blue  = data[3];

  this.emit('chromaReading', clear, red, green, blue);
};

NodeSensor.prototype.parseChromaTemperatureReading = function(type, subtype, data) {
  var temperature = data.readFloatBE(0);

  this.emit('chromaTemperatureReading', temperature);
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

NodeSensor.prototype.parseThermaReading = function(type, subtype, data) {
  var irTemperature = data.readFloatLE(0);

  this.emit('thermaTemperatureReading', irTemperature);
};

NodeSensor.prototype.writeThermocoupleMode = function(enabled, period, callback) {
  // TODO: is this right?
  this.writeCommand(
    'TCPL,' +
    (enabled ? '1' : '0') + ',' +
    Math.round(period / 10) + ',' +
    '0',
    callback
  );
};

NodeSensor.prototype.parseThermocoupleReading = function(type, subtype, data) {
  // TODO: is this right?
  var thermocouplTemperature = data.readFloatLE(0) / 100.0;

  this.emit('thermocoupleTemperatureReading', thermocouplTemperature);
};

NodeSensor.prototype.parseBarCodeReading = function(type, subtype, data) {
  var barCode = data.toString();

  this.emit('barCodeReading', barCode);
};

module.exports = NodeSensor;

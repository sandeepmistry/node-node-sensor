node-node-sensor
================

node.js lib for [Variable Inc.'s](http://variableinc.com) [NODE sensor](http://variableinc.com/product/ios-platform-node/)

Supported modules:

 * Kore
 * [Luma](http://variableinc.com/luma-led-flashlight/)
 * [Clima](http://variableinc.com/product/new-clima-climate-and-weather-sensor/)
 * [Therma](http://variableinc.com/therma-temperature-sensor/)
 * [Themocouple](http://variableinc.com/product/thermocouple/)
 * [Barcode](http://variableinc.com/product/node-barcode/)

Unsupported modules:

 * [Oxa](http://variableinc.com/oxa-gas-sensors/)
   * Need to understand calibration
 * [Chroma](http://variableinc.com/chroma-color-sensor/)
   * Need to understand data
 * [CO2](http://variableinc.com/product/node-co2/)
   * No accress to module

Install
-------

npm install node-sensor

Usage
-----

    var NodeSensor = require('node-sensor');

__Discover__

    NodeSensor.discover(callback(nodeSensor));

__Connect__

    nodeSensor.connect(callback);

__Disconnect__

    nodeSensor.disconnect(callback);

__Discover Services and Characteristics__

    nodeSensor.discoverServicesAndCharacteristics(callback);

__Setup__

    nodeSensor.setup(callback);

__Kore__

    nodeSensor.readDeviceName(callback(deviceName));

    nodeSensor.readVersion(callback(firmware, model));

    nodeSensor.readStatus(callback(batteryLevel, moduleA, moduleB));

    nodeSensor.readModuleSubtypes(callback(moduleASubtype, moduleBSubtype));

    nodeSensor.readSerials(callback(core, moduleA, moduleB));

    nodeSensor.readModuleVersions(callback(moduleAVersion, moduleBVersion));

    nodeSensor.readQuietMode(callback(on));

    // accelerometer, gyroscope, magnetometer are true/false
    // period in ms
    nodeSensor.writeKoreMode(accelerometer, gyroscope, magnetometer, period, callback);

Events:

    nodeSensor.on('buttonPush', callback);
    nodeSensor.on('buttonRelease', callback);

    nodeSensor.on('koreAccelerometerReading', callabck(x, y, z));
    nodeSensor.on('koreGyroscopeReading', callabck(x, y, z));
    nodeSensor.on('koreMagnetometerReading', callabck(x, y, z));

__Luma__

    // mode 0 - 255, 1 bit per LED
    nodeSensor.writeLumaMode(mode, callback);

    // strobe in Hz
    nodeSensor.writeLumaStrobe(strobe, callback);

__Clima__

    // temperaturePressure, humidity, lightProximity are true/false
    // period in ms
    nodeSensor.writeClimaMode(temperaturePressure, humidity, lightProximity, period, callback)

Events:

    // temperature in °C
    nodeSensor.on('climaTemperatureReading', callback(temperature));

    // pressure in kPa
    nodeSensor.on('climaPressureReading', callback(pressure));

    // humidity in %
    nodeSensor.on('climaHumidityReading', callback(humidity));

    // light in lx
    nodeSensor.on('climaLightReading', callback(light));

__Therma__

    // ir, led are true/false
    // period in ms
    nodeSensor.writeThermaMode(ir, led, period, callback);

Events:

    // temperature in °C
    nodeSensor.on('thermaTemperatureReading', callback(temperature));

__Thermocouple__

    // enable is true/false
    // period in ms
    nodeSensor.writeThermocoupleMode(enable, period, callback);

Events:

    // temperature in °C
    nodeSensor.on('thermocoupleTemperatureReading', callback(temperature));

__Barcode__

Events:

    nodeSensor.on('barCodeReading', callback(barCode));

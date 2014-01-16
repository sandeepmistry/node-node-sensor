var util = require('util');

var bleno = require('bleno');

var BlenoPrimaryService = bleno.PrimaryService;
var BlenoCharacteristic = bleno.Characteristic;
var BlenoDescriptor = bleno.Descriptor;

console.log('pseudo');

bleno.on('stateChange', function(state) {
  console.log('on -> stateChange: ' + state);

  if (state === 'poweredOn') {
    // B04C05A47F18
    // 000000000000
    bleno.startAdvertising('NODE-000000000000', ['da2b84f1627948debdc0afbea0226079']);
  } else {
    bleno.stopAdvertising();
  }
});

bleno.on('advertisingStart', function(error) {
  console.log('on -> advertisingStart ' + error);

  if (!error) {
    bleno.setServices([
      new BlenoPrimaryService({
        uuid: '180f',
        characteristics: [
          new BlenoCharacteristic({
            uuid: '2a19',
            properties: ['read', 'notify'],
            onReadRequest: function(offset, callback) {
              console.log('2a19 onReadRequest');

              callback(BlenoCharacteristic.RESULT_SUCCESS, new Buffer('64', 'hex'));
            },
            onSubscribe: function(maxValueSize, updateValueCallback) {
              console.log('2a19 onSubscribe');
            },
            onUnsubscribe: function(maxValueSize, updateValueCallback) {
              console.log('2a19 onUnsubscribe');
            }
          })
        ]
      }),
      new BlenoPrimaryService({
        uuid: 'da2b84f1627948debdc0afbea0226079',
        characteristics: [
          new BlenoCharacteristic({
            uuid: '99564a02dc014d3cb04e3bb1ef0571b2',
            properties: ['read'],
            onReadRequest: function(offset, callback) {
              console.log('99564a02dc014d3cb04e3bb1ef0571b2 onReadRequest');

              var data = new Buffer('03000218001a001c001d001f0021002200', 'hex');

              callback(BlenoCharacteristic.RESULT_SUCCESS, data);
            }
          }),
          new BlenoCharacteristic({
            uuid: 'a87988b9694c479c900e95dfa6c00a24',
            properties: ['read', 'write'],
            onReadRequest: function(offset, callback) {
              console.log('a87988b9694c479c900e95dfa6c00a24 onReadRequest');

              callback(BlenoCharacteristic.RESULT_SUCCESS, new Buffer('01', 'hex'));
            },
            onWriteRequest: function(data, offset, withoutResponse, callback) {
              console.log('a87988b9694c479c900e95dfa6c00a24 onWriteRequest: ' + data.toString('hex'));

              callback(BlenoCharacteristic.RESULT_SUCCESS);
            }
          }),
          new BlenoCharacteristic({
            uuid: 'bf03260c72054c25af4393b1c299d159',
            properties: ['read', 'write'],
            onWriteRequest: function(data, offset, withoutResponse, callback) {
              console.log('bf03260c72054c25af4393b1c299d159 onWriteRequest: ' + data.toString('hex'));

              callback(BlenoCharacteristic.RESULT_SUCCESS);
            }
          }),
          new BlenoCharacteristic({
            uuid: '18cda7844bd3437085bbbfed91ec86af',
            properties: ['indicate']
          }),
          new BlenoCharacteristic({
            uuid: '0a1934f524b84f13984237bb167c6aff',
            properties: ['read', 'writeWithoutResponse', 'write'],
            onReadRequest: function(offset, callback) {
              console.log('0a1934f524b84f13984237bb167c6aff onReadRequest');

              callback(BlenoCharacteristic.RESULT_SUCCESS, new Buffer('', 'hex'));
            },
            onWriteRequest: function(data, offset, withoutResponse, callback) {
              console.log('0a1934f524b84f13984237bb167c6aff onWriteRequest: ' + data.toString('hex'));

              callback(BlenoCharacteristic.RESULT_SUCCESS);
            }
          }),
          new BlenoCharacteristic({
            uuid: 'fdd6b4d3046d4330bdec1fd0c90cb43b',
            properties: ['read', 'notify', 'indicate'],
            onReadRequest: function(offset, callback) {
              console.log('fdd6b4d3046d4330bdec1fd0c90cb43b onReadRequest');

              callback(BlenoCharacteristic.RESULT_SUCCESS, new Buffer('00', 'hex'));
            },
            onSubscribe: function(maxValueSize, updateValueCallback) {
              console.log('fdd6b4d3046d4330bdec1fd0c90cb43b onSubscribe');

              updateValueCallback(new Buffer('00', 'hex'));
            },
            onUnsubscribe: function(maxValueSize, updateValueCallback) {
              console.log('fdd6b4d3046d4330bdec1fd0c90cb43b onUnsubscribe');
            }
          })
        ]
      })
    ]);
  }
});

bleno.on('advertisingStop', function() {
  console.log('on -> advertisingStop');
});

bleno.on('servicesSet', function() {
  console.log('on -> servicesSet');
});

/**
 * Sample BLE React Native App
 *
 * @format
 * @flow strict-local
 */

import React, {useState, useEffect} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  NativeModules,
  NativeEventEmitter,
  Button,
  Platform,
  PermissionsAndroid,
  FlatList,
  TouchableHighlight,
} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';

import BleManager from 'react-native-ble-manager';
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const App = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [enemyHealth, setEnemyHealth] = useState(1000);
  const [powerReadings, setPowerReadings] = useState([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const [totalPower, setTotalPower] = useState(0);
  const [serviceData, setServiceData] = useState({});
  const peripherals = new Map();
  const [list, setList] = useState([]);

  const startScan = () => {
    if (!isScanning) {
      BleManager.scan([], 3, true)
        .then(results => {
          console.log('Scanning...');
          setIsScanning(true);
        })
        .catch(err => {
          console.error(err);
        });
    }
  };

  useEffect(() => {
    if (totalPower >= 1000) {
      setTotalPower(0);
      setEnemyHealth(prev => prev - 10);
    }
  }, [totalPower]);

  const handleStopScan = () => {
    console.log('Scan is stopped');
    setIsScanning(false);
  };

  const handleDisconnectedPeripheral = data => {
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      setList(Array.from(peripherals.values()));
    }
    // console.log('Disconnected from ' + data.peripheral);
  };

  function nameParser(name: string) {
    const nameKey = {
      '1818': 'Power Service',
      '2A63': 'Power Characteristic',
    };
    return nameKey[name] || name;
  }

  function bitParser(bitValue: number, index: number) {
    const bitKey = {
      0: 'More Data',
      1: 'Average Speed present',
      2: 'Instantaneous Cadence',
      3: 'Average Cadence',
      4: 'Total Distance Present',
      5: 'Resistance Level Present',
      6: 'Instantaneous Power Present',
      7: 'Average Power Present',
      8: 'Expended Energy Present',
      9: 'Heart Rate Present',
      10: 'Metabolic Equivalent Present',
      11: 'Elapsed Time Present',
      12: 'Remaining Time Present',
    };

    return `${bitKey[index] || index}: ${bitValue}`;
  }

  function guessBitParser(acc, bitValue, index: number) {
    const bitKey = {
      2: 'Instantaneous Power',
      11: 'Distance',
      12: 'Number Of Pedal Strokes',
    };

    return bitKey[index] ? [`${bitKey[index]}: ${bitValue}`] : acc;
  }

  const handleUpdateValueForCharacteristic = ({
    characteristic,
    service,
    peripheral,
    value,
  }) => {
    service = nameParser(service);
    characteristic = nameParser(characteristic);
    // value = value.map(bitParser);

    function updatePowerValues() {
      setPowerReadings(prev => [...prev, value[2]].slice(1, 11));
      setTotalPower(prev => prev + value[2]);
    }

    service === 'Power Service' &&
      characteristic === 'Power Characteristic' &&
      updatePowerValues();
    //  setServiceData(prev => ({
    //     ...prev,
    //     [service]: {
    //       ...prev[service],
    //       [characteristic]: value,
    //     },
    //   }));
  };

  const average = (arr: number[]): number =>
    Number((arr.reduce((p, c) => p + c, 0) / arr.length).toFixed(0));

  const retrieveConnected = () => {
    BleManager.getConnectedPeripherals([]).then(results => {
      let id = '';
      if (results.length == 0) {
        console.log('No connected peripherals');
      }
      for (var i = 0; i < results.length; i++) {
        var peripheral = results[i];
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
        id = peripheral.id;
        setList(Array.from(peripherals.values()));
      }

      id && getData();

      function getData() {
        BleManager.retrieveServices(id).then(info => {
          for (var j = 0; j < info?.characteristics?.length! || 0; j++) {
            let service = info?.characteristics?.[j].service!;
            let characteristic = info?.characteristics?.[j].characteristic!;
            // let properties = info.characteristics?.[j].properties || [];

            BleManager.startNotification(id, service, characteristic);
          }
        });
      }
    });
  };

  const handleDiscoverPeripheral = peripheral => {
    // console.log('Got ble peripheral', peripheral);
    if (!peripheral.name) {
      peripheral.name = 'NO NAME';
    }
    peripherals.set(peripheral.id, peripheral);
    setList(Array.from(peripherals.values()));
  };

  const testPeripheral = peripheral => {
    if (peripheral) {
      if (peripheral.connected) {
        BleManager.disconnect(peripheral.id);
      } else {
        BleManager.connect(peripheral.id)
          .then(() => {
            let p = peripherals.get(peripheral.id);
            if (p) {
              p.connected = true;
              peripherals.set(peripheral.id, p);
              setList(Array.from(peripherals.values()));
            }
            // console.log('Connected to ' + peripheral.id);

            setTimeout(function readRSSI() {
              BleManager.retrieveServices(peripheral.id).then(
                peripheralData => {
                  BleManager.readRSSI(peripheral.id).then(rssi => {
                    let p = peripherals.get(peripheral.id);
                    if (p) {
                      p.rssi = rssi;
                      peripherals.set(peripheral.id, p);
                      setList(Array.from(peripherals.values()));
                    }
                  });
                },
              );
            }, 900);
          })
          .catch(error => {
            console.log('Connection error', error);
          });
      }
    }
  };

  useEffect(() => {
    BleManager.start({showAlert: false});

    if (!bleManagerEmitter) {
      return;
    }

    bleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      handleDiscoverPeripheral,
    );
    bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan);
    bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      handleDisconnectedPeripheral,
    );
    bleManagerEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      handleUpdateValueForCharacteristic,
    );

    if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ).then(result => {
        if (result) {
          console.log('Permission is OK');
        } else {
          PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ).then(result => {
            if (result) {
              console.log('User accept');
            } else {
              console.log('User refuse');
            }
          });
        }
      });
    }

    return () => {
      console.log('unmount');
      if (!bleManagerEmitter.removeListener) {
        return;
      }
      bleManagerEmitter.removeListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral,
      );
      bleManagerEmitter.removeListener('BleManagerStopScan', handleStopScan);
      bleManagerEmitter.removeListener(
        'BleManagerDisconnectPeripheral',
        handleDisconnectedPeripheral,
      );
      bleManagerEmitter.removeListener(
        'BleManagerDidUpdateValueForCharacteristic',
        handleUpdateValueForCharacteristic,
      );
    };
  }, []);

  const renderItem = item => {
    const color = item.connected ? 'grey' : '#fff';
    return (
      <TouchableHighlight onPress={() => testPeripheral(item)}>
        <View style={[styles.row, {backgroundColor: color}]}>
          <Text
            style={{
              fontSize: 12,
              textAlign: 'center',
              color: '#333333',
              padding: 10,
            }}>
            {item.name}
          </Text>
          <Text
            style={{
              fontSize: 10,
              textAlign: 'center',
              color: '#333333',
              padding: 2,
            }}>
            RSSI: {item.rssi}
          </Text>
          <Text
            style={{
              fontSize: 8,
              textAlign: 'center',
              color: '#333333',
              padding: 2,
              paddingBottom: 20,
            }}>
            {item.id}
          </Text>
        </View>
      </TouchableHighlight>
    );
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scrollView}>
          {global.HermesInternal == null ? null : (
            <View style={styles.engine}>
              <Text style={styles.footer}>Engine: Hermes</Text>
            </View>
          )}
          <View style={styles.body}>
            <View style={{margin: 10}}>
              <Button
                title={'Scan Bluetooth (' + (isScanning ? 'on' : 'off') + ')'}
                onPress={() => startScan()}
              />
            </View>

            <View style={{margin: 10}}>
              <Button
                title="Retrieve connected peripherals"
                onPress={() => retrieveConnected()}
              />
            </View>

            {list.length == 0 && (
              <View style={{flex: 1, margin: 20}}>
                <Text style={{textAlign: 'center'}}>No peripherals</Text>
              </View>
            )}
          </View>
          <View>
            {console.log(powerReadings)}
            <Text>Average Power: {`${average(powerReadings)}`}w</Text>
            <Text>Next Attack:</Text>
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                backgroundColor: "red"
              }}>
              <View
                style={{
                  width: `${((totalPower / 1000) * 100).toFixed(0)}%`,
                  height: 10,
                  backgroundColor: 'green',
                  overflow: 'visible',
                }}></View>
            </View>
            <Text>Enemy Health: {`${enemyHealth}`} HP</Text>
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                backgroundColor: "red"
              }}>
              <View
                style={{
                  width: `${((enemyHealth / 1000) * 100).toFixed(0)}%`,
                  height: 10,
                  backgroundColor: 'green',
                  overflow: 'visible',
                }}></View>
            </View>
            {Object.keys(serviceData).map(service => {
              const characteristicText = Object.keys(serviceData[service]).map(
                characteristic => {
                  const text = `${characteristic}: ${serviceData[service][characteristic]}`;
                  const values = serviceData[service][characteristic].map(
                    value => <Text>{value}</Text>,
                  );
                  return (
                    <>
                      <Text key={characteristic}>{characteristic}</Text>
                      {values}
                    </>
                  );
                },
              );
              return (
                <>
                  <Text style={{fontWeight: '800'}}>{service}</Text>
                  {characteristicText}
                </>
              );
            })}
          </View>
        </ScrollView>
        <FlatList
          data={list}
          renderItem={({item}) =>
            item.name.includes('KICKR') ? renderItem(item) : null
          }
          keyExtractor={item => item.id}
        />
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.lighter,
  },
  engine: {
    position: 'absolute',
    right: 0,
  },
  body: {
    backgroundColor: Colors.white,
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.black,
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.dark,
  },
  highlight: {
    fontWeight: '700',
  },
  footer: {
    color: Colors.dark,
    fontSize: 12,
    fontWeight: '600',
    padding: 4,
    paddingRight: 12,
    textAlign: 'right',
  },
});

export default App;

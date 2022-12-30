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
  EmitterSubscription,
  Image,
} from 'react-native';

import BleManager, {Peripheral} from 'react-native-ble-manager';
import useMonster from './useMonster';
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const App = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [powerReadings, setPowerReadings] = useState([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const [totalPower, setTotalPower] = useState(0);
  const peripherals = new Map();
  const [list, setList] = useState<any[]>([]);
  const monster = useMonster({
    health: 1000,
    attack: 10,
    handleMonsterAttack: damage => {
      setPlayerHealth(playerHealth - damage);
    },
    image: require('./img/ghost.jpg'),
  });

  async function startScan() {
    try {
      await BleManager.scan([], 3, true);
      setIsScanning(true);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(handleTotalPowerChange, [totalPower]);

  function handleTotalPowerChange() {
    if (totalPower >= 1000) {
      setTotalPower(0);
      monster.takeDamage(10);
    }
  }

  function handleStopScan() {
    setIsScanning(false);
  }

  function handleDisconnectedPeripheral(data: any) {
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      setList(Array.from(peripherals.values()));
    }
    // console.log('Disconnected from ' + data.peripheral);
  }

  function nameParser(name: string) {
    const nameKey: {[code: string]: string} = {
      '1818': 'Power Service',
      '2A63': 'Power Characteristic',
    };
    return nameKey[name] || name;
  }

  const handleUpdateValueForCharacteristic = ({
    characteristic,
    service,
    peripheral,
    value,
  }: {
    characteristic: string;
    service: string;
    peripheral: string;
    value: string;
  }) => {
    service = nameParser(service);
    characteristic = nameParser(characteristic);
    // value = value.map(bitParser);

    function updatePowerValues() {
      setPowerReadings(prev => [...prev, Number(value[2])].slice(1, 11));
      setTotalPower(prev => prev + Number(value[2]));
    }

    service === 'Power Service' &&
      characteristic === 'Power Characteristic' &&
      updatePowerValues();
  };

  const average = (arr: number[]): number =>
    Number((arr.reduce((p, c) => p + c, 0) / arr.length).toFixed(0));

  const retrieveConnected = () => {
    BleManager.getConnectedPeripherals([]).then(results => {
      let id = '';
      if (results.length === 0) {
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

  const handleDiscoverPeripheral = (peripheral: Peripheral) => {
    // console.log('Got ble peripheral', peripheral);
    if (!peripheral.name) {
      peripheral.name = 'NO NAME';
    }
    peripherals.set(peripheral.id, peripheral);
    setList(Array.from(peripherals.values()));
  };

  const testPeripheral = (peripheral: Peripheral) => {
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

    const listeners: EmitterSubscription[] = [
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral,
      ),
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
      bleManagerEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        handleDisconnectedPeripheral,
      ),
      bleManagerEmitter.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        handleUpdateValueForCharacteristic,
      ),
    ];

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

    return function unsubscribe() {
      for (const listener of listeners) {
        listener.remove();
      }
    };
  }, []);

  const renderItem = (item: any) => {
    const color = item.connected ? 'grey' : '#fff';
    return (
      <TouchableHighlight onPress={() => testPeripheral(item)}>
        <View style={{backgroundColor: color}}>
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
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          <View>
            <View>
              <Button
                title={'Scan Bluetooth (' + (isScanning ? 'on' : 'off') + ')'}
                onPress={() => startScan()}
              />
            </View>

            <View>
              <Button
                title="Retrieve connected peripherals"
                onPress={() => retrieveConnected()}
              />
            </View>

            {list.length === 0 && (
              <View style={{flex: 1, margin: 20}}>
                <Text style={{textAlign: 'center'}}>No peripherals</Text>
              </View>
            )}
          </View>
          <View>
            <Text>Enemy Health: {`${monster.health}`} HP</Text>
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                backgroundColor: 'red',
              }}>
              <View
                style={{
                  width: `${((monster.health / 1000) * 100).toFixed(0)}%`,
                  height: 10,
                  backgroundColor: 'green',
                  overflow: 'visible',
                }}
              />
            </View>
            <View style={{flex: 1}}>
              <Image
                style={{width: '100%', marginTop: 10}}
                source={monster.image}
              />
            </View>
            <Text>Player Health: {`${playerHealth}`} HP</Text>
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                backgroundColor: 'red',
              }}>
              <View
                style={{
                  width: `${((playerHealth / 100) * 100).toFixed(0)}%`,
                  height: 10,
                  backgroundColor: 'green',
                  overflow: 'visible',
                }}
              />
            </View>
            <Text>Average Power: {`${average(powerReadings)}`}w</Text>
            <Text>Next Attack:</Text>
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                backgroundColor: 'red',
              }}>
              <View
                style={{
                  width: `${((totalPower / 1000) * 100).toFixed(0)}%`,
                  height: 10,
                  backgroundColor: 'green',
                  overflow: 'visible',
                }}
              />
            </View>
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
  nextAttackContainer: {},
  nextAttackBar: {},
  engine: {
    position: 'absolute',
    right: 0,
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
  footer: {
    fontSize: 12,
    fontWeight: '600',
    padding: 4,
    paddingRight: 12,
    textAlign: 'right',
  },
});

export default App;

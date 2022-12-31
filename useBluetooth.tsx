import React, {Dispatch, SetStateAction, useEffect, useState} from 'react';
import {
  EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
} from 'react-native';

import BleManager, {Peripheral} from 'react-native-ble-manager';
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

interface Props {
  setPowerReadings: Dispatch<SetStateAction<number[]>>;
  setTotalPower: Dispatch<SetStateAction<number>>;
}

const useBluetooth = ({setPowerReadings, setTotalPower}: Props) => {
  const [isScanning, setIsScanning] = useState(false);
  const peripherals = new Map();
  const [peripheralList, setPeripheralList] = useState<any[]>([]);

  async function startScan() {
    try {
      await BleManager.scan([], 3, true);
      setIsScanning(true);
    } catch (error) {
      console.error(error);
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
      setPeripheralList(Array.from(peripherals.values()));
    }
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

    function updatePowerValues() {
      setPowerReadings(prev => [...prev, Number(value[2])].slice(1, 11));
      setTotalPower(prev => prev + Number(value[2]));
    }

    service === 'Power Service' &&
      characteristic === 'Power Characteristic' &&
      updatePowerValues();
  };

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
        setPeripheralList(Array.from(peripherals.values()));
      }

      id && getData();

      function getData() {
        BleManager.retrieveServices(id).then(info => {
          for (var j = 0; j < info?.characteristics?.length! || 0; j++) {
            let service = info?.characteristics?.[j].service!;
            let characteristic = info?.characteristics?.[j].characteristic!;
            BleManager.startNotification(id, service, characteristic);
          }
        });
      }
    });
  };

  const handleDiscoverPeripheral = (peripheral: Peripheral) => {
    if (!peripheral.name) {
      peripheral.name = 'NO NAME';
    }
    peripherals.set(peripheral.id, peripheral);
    setPeripheralList(Array.from(peripherals.values()));
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
              setPeripheralList(Array.from(peripherals.values()));
            }

            setTimeout(function readRSSI() {
              BleManager.retrieveServices(peripheral.id).then(() => {
                BleManager.readRSSI(peripheral.id).then(rssi => {
                  let p = peripherals.get(peripheral.id);
                  if (p) {
                    p.rssi = rssi;
                    peripherals.set(peripheral.id, p);
                    setPeripheralList(Array.from(peripherals.values()));
                  }
                });
              });
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

    return function unsubscribe() {
      for (const listener of listeners) {
        listener.remove();
      }
    };
  }, []);

  return {
    startScan,
    retrieveConnected,
    testPeripheral,
    isScanning,
    peripheralList,
  };
};

export default useBluetooth;

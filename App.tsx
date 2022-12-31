import React, {useState, useEffect} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StatusBar,
  Button,
  FlatList,
  TouchableHighlight,
  Image,
} from 'react-native';

import useBluetooth from './useBluetooth';
import useMetronome from './useMetronome';
import useMonster from './useMonster';

const App = () => {
  useMetronome();
  const [playerHealth, setPlayerHealth] = useState(100);
  const [powerReadings, setPowerReadings] = useState([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const [totalPower, setTotalPower] = useState(0);
  const {
    startScan,
    retrieveConnected,
    testPeripheral,
    isScanning,
    peripheralList,
  } = useBluetooth({setPowerReadings, setTotalPower});
  const monster = useMonster({
    health: 1000,
    attack: 10,
    handleMonsterAttack: damage => {
      setPlayerHealth(playerHealth - damage);
    },
    image: require('./img/ghost.jpg'),
  });

  useEffect(handleTotalPowerChange, [totalPower]);

  function handleTotalPowerChange() {
    if (totalPower >= 1000) {
      setTotalPower(0);
      monster.takeDamage(10);
    }
  }

  const average = (arr: number[]): number =>
    Number((arr.reduce((p, c) => p + c, 0) / arr.length).toFixed(0));

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

            {peripheralList.length === 0 && (
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
          data={peripheralList}
          renderItem={({item}) =>
            item.name.includes('KICKR') ? renderItem(item) : null
          }
          keyExtractor={item => item.id}
        />
      </SafeAreaView>
    </>
  );
};

export default App;

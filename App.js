import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  PermissionsAndroid,
  Platform,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import axios from 'axios';
import { Card } from 'react-native-paper';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

const ESP32_DEVICE_NAME = 'ESP32test';
const MAX_HISTORY = 5000;
const RATE_PER_KWH = 8; // 8 rupees per unit

const PowerCard = ({ title, voltage, current, onCommandOn, onCommandOff }) => (
  <Card style={styles.card}>
    <Card.Title title={title} titleStyle={styles.cardTitle} />
    <Card.Content>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, styles.buttonOn]} onPress={onCommandOn}>
         <Text style={styles.buttonText}>ON</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.buttonOff]} onPress={onCommandOff}>
          <Text style={styles.buttonText}>OFF</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.readingsRow}>
        <View style={styles.readingcol}>
          <Text style={styles.text}>Voltage</Text>
          <Text style={styles.text}>{voltage || '0'}V</Text>
        </View>
        <View style={styles.readingcol}>
          <Text style={styles.text}>Current</Text>
          <Text style={styles.text}>{current || '0'}A</Text>
        </View>
      </View>
    </Card.Content>
  </Card>
);

const PowerScreen = () => {
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [volt1, setVoltage1] = useState('');
  const [volt2, setVoltage2] = useState('');
  const [adc1List, setAdc1List] = useState([]);
  const [adc2List, setAdc2List] = useState([]);
  const [device1On, setDevice1On] = useState(false);
  const [device2On, setDevice2On] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [powerUsed1, setPowerUsed1] = useState(0);
  const [powerUsed2, setPowerUsed2] = useState(0);
  const [price1, setPrice1] = useState(0);
  const [price2, setPrice2] = useState(0);
  const [sessionId, setSessionId] = useState('');

  const [device1ModalVisible, setDevice1ModalVisible] = useState(false);
  const [device2ModalVisible, setDevice2ModalVisible] = useState(false);

  const timerInterval1 = useRef(null);
  const timerInterval2 = useRef(null);
    const timerRef = useRef(null);

    const handleData = (rawData) => {
      if (rawData.includes('Current1')) {
        const match = rawData.match(/Current1 \(Amps\): ([0-9.]+)/);
        if (match) {
          setAdc1List((prev) => [...prev.slice(-MAX_HISTORY + 1), match[1]]);
        }
      }
      if (rawData.includes('Current2')) {
        const match = rawData.match(/Current2 \(Amps\): ([0-9.]+)/);
        if (match) {
          setAdc2List((prev) => [...prev.slice(-MAX_HISTORY + 1), match[1]]);
        }
      }
    };

  useEffect(() => {
    const session = `session-${Date.now()}`;
    setSessionId(session);
    const setupBluetoothAndUpdateBills = async () => {
      // Request Bluetooth permissions (Android only)
      if (Platform.OS === 'android') {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
      }

//      try {
//        await axios.post('https://a559-2409-408c-be00-30ba-9809-1ae-d011-6558.ngrok-free.app/new/device1');
//        await axios.post('https://a559-2409-408c-be00-30ba-9809-1ae-d011-6558.ngrok-free.app/new/device2');
//        console.log('Latest bills updated on app startup.');
//      } catch (apiError) {
//        console.error('API error updating latest bills:', apiError);
//      }

      try {
        const bonded = await RNBluetoothClassic.getBondedDevices();
        const esp32 = bonded.find((d) => d.name === ESP32_DEVICE_NAME);

        if (esp32) {
          const connected = await esp32.connect();
          if (connected) {
            setConnectedDevice(esp32);
            esp32.onDataReceived((event) => {
              const lines = event.data.trim().split('\n');
              lines.forEach(parseBluetoothData);
              lines.forEach(handleData);
            });
          }
        } else {
          Alert.alert('ESP32 not found');
        }
      } catch (err) {
        console.error('Bluetooth error:', err);
      }
    };

    setupBluetoothAndUpdateBills();
  }, []);


  const parseBluetoothData = (line) => {
    const parts = line.split(':');
    if (parts.length === 2) {
      const key = parts[0].trim().toLowerCase();
      const value = parts[1].trim();

      if (key === 'voltage1') setVoltage1(value);
      else if (key === 'voltage2') setVoltage2(value);
      else if (key === 'current1') {
        setAdc1List((prev) => [...prev.slice(-MAX_HISTORY + 1), value]);
      } else if (key === 'current2') {
        setAdc2List((prev) => [...prev.slice(-MAX_HISTORY + 1), value]);
      }
    }
  };

  const sendCommand = async (command) => {
    if (connectedDevice) await connectedDevice.write(`${command}\n`);
  };

  const handleDeviceToggle = (device, on) => {
    const command = on ? (device === 1 ? 'on' : 'on1') : (device === 1 ? 'off' : 'off1');
    sendCommand(command);

    if (device === 1) {
      setDevice1On(on);
      if (on) startLiveTimer(1);
      else stopLiveTimer(1);
    } else {
      setDevice2On(on);
      if (on) startLiveTimer(2);
      else stopLiveTimer(2);
    }
  };

  const startLiveTimer = (device) => {
    if (device === 1) {
      timerInterval1.current = setInterval(() => updatePowerPrice(1), 1000);
    } else {
      timerInterval2.current = setInterval(() => updatePowerPrice(2), 1000);
    }
  };

  const stopLiveTimer = (device) => {
    if (device === 1) {
      if (timerInterval1.current) clearInterval(timerInterval1.current);
    } else {
      if (timerInterval2.current) clearInterval(timerInterval2.current);
    }
  };

  const average = (list) => {
    const nums = list.map(Number).filter((n) => !isNaN(n));
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  };

  const updatePowerPrice = (device) => {
    if (device === 1) {
      const avgAmp = average(adc1List);
      const voltage = parseFloat(volt1 || '0'); // Ensure voltage is received
      const powerIncrement = (avgAmp * voltage) / 3600;
      console.log(`Device 1 - AvgAmp: ${avgAmp}, Voltage: ${voltage}, PowerIncrement: ${powerIncrement}`);
      setPowerUsed1((prev) => {
        const newPowerUsed = (parseFloat(prev) || 0) + powerIncrement;
        const kWh = newPowerUsed / 1000;
        const newPrice = kWh * RATE_PER_KWH;
        console.log(`PowerUsed1: ${newPowerUsed}, kWh: ${kWh}, Price1: ${newPrice}`);
        setPrice1(newPrice.toFixed(4));
        return newPowerUsed;
      });
    } else {
      const avgAmp = average(adc2List);
      const voltage = parseFloat(volt2 || '0');
      const powerIncrement = (avgAmp * voltage) / 3600;
      console.log(`Device 2 - AvgAmp: ${avgAmp}, Voltage: ${voltage}, PowerIncrement: ${powerIncrement}`);
      setPowerUsed2((prev) => {
        const newPowerUsed = (parseFloat(prev) || 0) + powerIncrement;
        const kWh = newPowerUsed / 1000;
        const newPrice = kWh * RATE_PER_KWH;
        console.log(`PowerUsed2: ${newPowerUsed}, kWh: ${kWh}, Price2: ${newPrice}`);
        setPrice2(newPrice.toFixed(4));
        return newPowerUsed;
      });
    }
  };

  const startTimers = () => {
    setMinutes('')
    const mins = parseInt(minutes);
    if (isNaN(mins) || mins <= 0) {
      Alert.alert('Invalid input', 'Please enter a valid number of minutes.');
      return;
    }

    const milliseconds = mins * 60 * 1000;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      Alert.alert('Over  Power Usage');
    }, milliseconds);
  };

const storeDevice1Bill = async () => {
    try {
    console.log("Heyy")
    console.log(`price is ${price1}, power used is ${powerUsed1}`)
      await axios.post('https://b804-2401-4900-91ce-4a04-c81c-a63a-b6ec-1cf4.ngrok-free.app/bill/device1', {
        powerUsed: powerUsed1 || 0,
        price: price1 || 0,
        sessionId
      });
      alert('Device 1 bill stored');
    } catch (err) {
    console.log(err)
      alert('Error storing Device 1 bill');
    }
  };

  const storeDevice2Bill = async () => {
    try {
      await axios.post('https://b804-2401-4900-91ce-4a04-c81c-a63a-b6ec-1cf4.ngrok-free.app/bill/device2', {
        powerUsed: powerUsed2 || 0,
        price: price2 || 0,
        sessionId
      });
      alert('Device 2 bill stored');
    } catch (err) {
      alert('Error storing Device 2 bill');
}
};

const [month, setMonth] = useState('');
const [year, setYear] = useState('');
const [result1, setResult1] = useState(null);
const [result2, setResult2] = useState(null);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PowerCard
        title="Device 1"
        voltage={volt1}
        current={adc1List[adc1List.length - 1] || '0'}
        onCommandOn={() => handleDeviceToggle(1, true)}
        onCommandOff={() => {
          storeDevice1Bill();
          handleDeviceToggle(1, false);
        }}
      />
      <PowerCard
        title="Device 2"
        voltage={volt2}
        current={adc2List[adc2List.length - 1] || '0'}
        onCommandOn={() => handleDeviceToggle(2, true)}
        onCommandOff={() =>{
        storeDevice2Bill();
        handleDeviceToggle(2, false)}}
      />

              <TouchableOpacity
                onPress={() => {
                  setDevice1ModalVisible(true);
                }}
                style={styles.Mbutton}
              >
                <Text style={styles.buttonText}>Bill of Device 1</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setDevice2ModalVisible(true);
                }}
                style={styles.Mbutton}
              >
                <Text style={styles.buttonText}>Bill of Device 2</Text>
              </TouchableOpacity>
        <View style={{ marginVertical: 10 }}>
          <TextInput
            style={styles.input}
            placeholder="Enter Month (1-12)"
            placeholderTextColor="#888"
            keyboardType="numeric"
            value={month}
            onChangeText={setMonth}
          />
          <TextInput
            style={styles.input}
            placeholder="Enter Year (e.g., 2025)"
            placeholderTextColor="#888"
            keyboardType="numeric"
            value={year}
            onChangeText={setYear}
          />

          <TouchableOpacity
            onPress={async () => {
              try {
                const res = await axios.post('https://b804-2401-4900-91ce-4a04-c81c-a63a-b6ec-1cf4.ngrok-free.app/bill/device1/monthly', {
                  month: parseInt(month),
                  year: parseInt(year)
                });
                setResult1(res.data);
              } catch (err) {
                console.log(err);
              }
            }}
            disabled={!month || !year}
              style={[
                styles.resultButton,
                (!month || !year) && { backgroundColor: '#ccc' }
              ]}
          >
            <Text style={styles.buttonText}>Get Result Monthly for Device 1</Text>
          </TouchableOpacity>

          {result1 && (
            <View>
              <Text style={styles.resultText}>Device 1 - Power Used: {result1.powerUsed.toFixed(4)} Wh</Text>
              <Text style={styles.resultText}>Device 1 - Price: ₹{result1.price}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={async () => {
              try {
                const res = await axios.post('https://b804-2401-4900-91ce-4a04-c81c-a63a-b6ec-1cf4.ngrok-free.app/bill/device2/monthly', {
                  month: parseInt(month),
                  year: parseInt(year)
                });
                setResult2(res.data);
              } catch (err) {
                console.log(err);
              }
            }}
            disabled={!month || !year}
              style={[
                styles.resultButton,
                (!month || !year) && { backgroundColor: '#ccc' }
              ]}
          >
            <Text style={styles.buttonText}>Get Result Monthly for Device 2</Text>
          </TouchableOpacity>

          {result2 && (
            <View>
              <Text style={styles.resultText}>Device 2 - Power Used: {result2.powerUsed.toFixed(4)} Wh</Text>
              <Text style={styles.resultText}>Device 2 - Price: ₹{result2.price}</Text>
            </View>
          )}
        </View>

      <View style={styles.inputContainer}>
        <Text style={styles.text}>Set Limit (minutes):</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={minutes}
          onChangeText={setMinutes}
        />
        <TouchableOpacity style={styles.Mbutton} onPress={startTimers}>
          <Text style={styles.buttonText}>Start Timer</Text>
        </TouchableOpacity>
      </View>

      {/* Device 1 Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={device1ModalVisible}
        onRequestClose={() => setDevice1ModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Device 1</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.tableHeader}>Parameter</Text>
                <Text style={styles.tableHeader}>Value</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>Power Used</Text>
                <Text style={styles.tableCell}>{powerUsed1.toFixed(4)} Wh</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>Price</Text>
                <Text style={styles.tableCell}>₹{(parseFloat(price1) || 0).toFixed(4)}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setDevice1ModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Device 2 Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={device2ModalVisible}
        onRequestClose={() => setDevice2ModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Device 2</Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={styles.tableHeader}>Parameter</Text>
                <Text style={styles.tableHeader}>Value</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>Power Used</Text>
                <Text style={styles.tableCell}>{powerUsed2.toFixed(4)} Wh</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.tableCell}>Price</Text>
                <Text style={styles.tableCell}>₹{(parseFloat(price2) || 0).toFixed(4)}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setDevice2ModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  card: {
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    width: '45%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonOn: {
    backgroundColor: 'green',
  },
  buttonOff: {
    backgroundColor: 'red',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  readingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  readingcol: {
    width: '48%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
    width: '80%',
    alignSelf: 'center'
  },
  resultButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
    alignItems: 'center',
    width: '80%',
    alignSelf: 'center'
  },
  resultText: {
    textAlign: 'center',
    marginVertical: 5,
    fontSize: 16
  },
  text: {
    fontSize: 14,
  },
  innerSeparator: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 5,
  },
  historyButton: {
    padding: 10,
    backgroundColor: '#4caf50',
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 10,
  },
  historyButtonText: {
    color: 'white',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  historyList: {
    maxHeight: 200,
  },
  historyItem: {
    fontSize: 14,
  },
  modalCloseButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: 'red',
    borderRadius: 5,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: 'white',
    fontSize: 16,
  },
  timerContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 16,
  },
  input: {
    width: '80%',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    marginVertical: 10,
    paddingLeft: 10,
    borderRadius: 5,
  },
  timerButton: {
    backgroundColor: '#4caf50',
    padding: 10,
    borderRadius: 5,
  },
  timerButtonText: {
    color: 'white',
    fontSize: 16,
  },
  container: {
    padding: 16,
    backgroundColor: '#e8f5e9',
  },
  card: {
    marginVertical: 10,
    borderRadius: 12,
    elevation: 4,
    paddingBottom: 20,
  },
  cardTitle: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    backgroundColor: 'white',
    margin: '3%',
    padding: 15,
    marginLeft: '-3%',
    color: '#29a34e',
    borderRadius: 10,
  },
  readingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginVertical: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    color: '#333',
  },
  buttonContainer: {
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 17,
    marginBottom: 17,
    padding: 15,
    borderRadius: 10,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 45,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonOn: {
    backgroundColor: '#388e3c',
  },
  buttonOff: {
    backgroundColor: '#d32f2f',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  readingcol: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  innerSeparator: {
    width: '80%',
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 8,
  },
  timerContainer: {
    marginTop: 30,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  timerLabel: {
    fontSize: 18,
    marginBottom: 10,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#388e3c',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  timerButton: {
    backgroundColor: '#43a047',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  timerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  Mbutton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    marginVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  resultText: {
    fontSize: 18,
    marginVertical: 10,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#f44336',
    padding: 10,
    borderRadius: 6,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
  table: {
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    overflow: 'hidden'
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc'
  },
  tableHeader: {
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
    textAlign: 'center'
  },
  tableCell: {
    fontSize: 15,
    flex: 1,
    textAlign: 'center'
  },
  closeButton: {
    backgroundColor: '#ff5c5c',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  openButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    margin: 10,
    borderRadius: 8
  },
  openButtonText: {
    color: 'white',
    fontWeight: 'bold'
  }
});

export default PowerScreen;

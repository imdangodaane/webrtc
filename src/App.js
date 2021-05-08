import './App.css';
import React from 'react';
import firebase from 'firebase/app';
import 'firebase/database';
import { v4 as uuidv4 } from 'uuid';
import { Modal, Input, Button, notification } from 'antd';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      localStream: null,
      remoteStream: null,
      roomId: null,
      peerConnection: null,
      ICEServerConfiguration: {
        iceServers: [
          {
            urls: [
              'stun:stun1.l.google.com:19302',
              'stun:stun2.l.google.com:19302',
            ],
          },
        ],
        iceCandidatePoolSize: 10,
      },
      requestDevices: {
        video: false,
        audio: true,
      },
      db: firebase.database(),
      isModalVisible: false,
    };
  }

  openMediaDevices = async (constraints) => {
    const localStream = await navigator.mediaDevices.getUserMedia(constraints);

    this.setState({
      localStream,
    });

    return localStream;
  }

  createRoom = async (configuration) => {
    const roomId = uuidv4();
    const peerConnection = new RTCPeerConnection(configuration);
    this.state.localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, this.state.localStream);
    });
    this.state.remoteStream = new MediaStream();
    peerConnection.addEventListener('track', async (event) => {
      this.state.remoteStream.addTrack(event.track, this.state.remoteStream);
    });

    this.registerPeerConnectionListeners(peerConnection);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const roomWithOffer = {
      offer: {
        type: offer.type,
        sdp: offer.sdp
      }
    };
    const roomRef = this.state.db.ref(`rooms/${roomId}`);

    await roomRef.set(roomWithOffer);

    roomRef.on('value', async (snapshot) => {
      const data = snapshot.val();
      if (data.answer) {
        console.log('🚀 -> App -> roomRef.on -> data.answer', data);
        await peerConnection.setRemoteDescription(data.answer);
      }
    });

    this.collectICECandidates(roomRef, peerConnection);

    this.setState({
      roomId,
      peerConnection,
    });
  }

  openJoinRoomModal = () => {
    this.setState({
      isModalVisible: true,
    });
  }

  joinRoomById = async () => {
    this.setState({
      isModalVisible: false,
    });

    const roomId = this.state.joinRoomId;
    const roomRef = this.state.db.ref(`rooms/${roomId}`);
    const roomSnapshot = await roomRef.get();
    console.log('🚀 -> App -> joinRoomById= -> roomSnapshot', roomSnapshot.val());

    if (roomSnapshot.exists) {
      const peerConnection = new RTCPeerConnection(this.state.ICEServerConfiguration);
      this.state.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.state.localStream);
      });
      this.state.remoteStream = new MediaStream();
      peerConnection.addEventListener('track', async (event) => {
        this.state.remoteStream.addTrack(event.track, this.state.remoteStream);
      });

      this.registerPeerConnectionListeners(peerConnection);

      const offer = roomSnapshot.val().offer;
      await peerConnection.setRemoteDescription(offer);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      const roomWithAnswer = {
          type: answer.type,
          sdp: answer.sdp,
      };
      await roomRef.set({
        ...roomSnapshot.val(),
        answer: roomWithAnswer,
      });

      this.collectICECandidates(roomRef, peerConnection);
    }

  }

  handleCancel = () => {
    this.setState({
      isModalVisible: false,
    });
  }

  onChangeRoomId = (roomId) => {
    console.log(roomId);
    this.setState({
      joinRoomId: roomId,
    });
  }

  registerPeerConnectionListeners = (peerConnection) => {
    peerConnection.addEventListener('icegatheringstatechange', () => {
      console.log(`ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    });
  
    peerConnection.addEventListener('connectionstatechange', () => {
      console.log(`Connection state change: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'connected') {
        console.log('Peers connected');
      }
    });
  
    peerConnection.addEventListener('signalingstatechange', () => {
      console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });
  
    peerConnection.addEventListener('iceconnectionstatechange ', () => {
      console.log(`ICE connection state change: ${peerConnection.iceConnectionState}`);
    });

    return peerConnection;
  }

  collectICECandidates = async (roomRef, peerConnection) => {
    console.log('🚀 -> App -> collectICECandidates= -> collectICECandidates');
    const roomSnapshot = await roomRef.get();
    console.log('🚀 -> App -> collectICECandidates= -> roomSnapshot', roomSnapshot);
    peerConnection.addEventListener('icecandidate', async event => {
      if (event.candidate) {
        console.log('🚀 -> App -> collectICECandidates= -> event.candidate', event.candidate);
        const json = event.candidate.toJSON();
        console.log('🚀 -> App -> collectICECandidates= -> json', json);
        await roomRef.set({
          ...roomSnapshot.val(),
          icecandidate: json,
        });
      }
    });

    roomRef.on('value', async (snapshot) => {
      const data = snapshot.val();
      if (data.icecandidate) {
        const candidate = new RTCIceCandidate(data.icecandidate);
        await peerConnection.addIceCandidate(candidate);
      }
    });
  }

  render() {
    return (
      <div className="App">
        <div>
          <Button onClick={async () => {
            await this.openMediaDevices(this.state.requestDevices);
            console.log('🚀 -> App -> <buttononClick={ -> this.state.localStream', this.state.localStream);
          }}
            disabled={!!this.state.localStream}
          >
            Open camera and audio
          </Button>
          <Button onClick={async () => {
            await this.createRoom(this.state.ICEServerConfiguration);
            console.log('🚀 -> App -> <buttononClick={ -> this.state', this.state);
          }}
            disabled={!!this.state.roomId || !this.state.localStream}
          >
            Create Room
          </Button>
          <Button onClick={this.openJoinRoomModal}
            disabled={!this.state.localStream}
          >
            Join room
          </Button>
          <Modal title="Join a room with ID:" visible={this.state.isModalVisible}
            onOk={this.joinRoomById}
            onCancel={this.handleCancel}
          >
            <Input placeholder="Enter room id:"
              onChange={(e) => this.onChangeRoomId(e.target.value)}
            />
          </Modal>
        </div>
        <p>You created a room with id:
          <Button onClick={() => {
            navigator.clipboard.writeText(this.state.roomId);
            notification.success({ message: 'Copied to clipboard' });
          }}>
            {this.state.roomId}
          </Button>
        </p>
        <div id="videos">
          <video id="localVideo" src={this.state.localStream} autoPlay playsInline></video>
          <video id="remoteVideo" src={this.state.remoteStream} autoPlay playsInline></video>
        </div>
      </div>
    )
  }
};

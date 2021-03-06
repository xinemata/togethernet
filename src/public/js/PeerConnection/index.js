import io from 'socket.io-client';
import store from '@js/store';
import { getBrowserRTC } from './ensureWebRTC';
import { handleData } from './dataReceiver';
import {
  addSystemNotifyMessage
} from '@js/Togethernet/systemMessage';
import { systemNotifyMsgDisconnect, systemNotifyMsgError } from '@js/constants.js';
import User from '@js/User';

export default class PeerConnection {
  constructor() {
    this._wrtc = getBrowserRTC();
    this.socket = io.connect();
    this.initiator = false;
  }

  connect = () => {

    this.socket.on('connect', () => {
      // clearSystemMessage();
      new User(this.socket.id).initialize();
      store.getCurrentRoom().goToRoom();
    });

    this.socket.on('initConnections', this.initConnections);
    this.socket.on('offer', this.handleReceivedOffer);
    this.socket.on('answer', this.handleReceivedAnswer);
    this.socket.on('candidate', this.addCandidate);
    this.socket.on('peerLeave', this.handlePeerLeaveSocket);
    this.socket.on(
      'archivedMessage',
      store.getRoom('archivalSpace').appendArchivedMessage
    );
    this.socket.on(
      'archivedMessageUpdated',
      store.getRoom('archivalSpace').archivedMessageUpdated
    );
    this.socket.on(
      'archivedMessageDeleted',
      store.getRoom('archivalSpace').archivedMessageDeleted
    );
    this.socket.on('error', this.handleSocketError);
    this.socket.on('disconnect', this.handleSocketDisconnect);
  };

  initConnections = async ({ peerId }) => {
    const peerConnection = this.initPeerConnection(peerId, { initiator: true });
    // clearSystemMessage();
    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
      });
      await peerConnection.setLocalDescription(offer);
      this.send({ type: 'sendOffers', offer, peerId });
    } catch (e) {
      console.log('error creating offer to connect to peers', e);
    }
  };

  handleReceivedOffer = async ({ offer, offerInitiator }) => {
    try {
      const peerConnection = this.initPeerConnection(offerInitiator, {
        initiator: false,
      });
      await peerConnection.setRemoteDescription(
        new this._wrtc.RTCSessionDescription(offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      this.send({ type: 'sendAnswer', answer, offerInitiator });
    } catch (err) {
      console.log('error receiving offer', err);
    }
  };

  initPeerConnection = (peerId, { initiator }) => {
    const peerConnection = new this._wrtc.RTCPeerConnection({
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:global.stun.twilio.com:3478',
          ],
        },
      ],
      sdpSemantics: 'unified-plan',
    });

    const peer = store.addPeer(peerId, peerConnection);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          type: 'trickleCandidate',
          candidate: new this._wrtc.RTCIceCandidate(event.candidate),
        });
      }
    };

    if (initiator) {
      const dataChannel = peerConnection.createDataChannel('tn', {
        reliable: true,
      });
      peer.dataChannel = this.setUpDataChannel({
        dataChannel,
        peerId,
        initiator,
      });
    } else {
      peerConnection.ondatachannel = (event) => {
        peer.dataChannel = this.setUpDataChannel({
          dataChannel: event.channel,
          peerId,
        });
      };
    }

    peerConnection.oniceconnectionstatechange = () => {
      if (
        peerConnection.iceConnectionState === 'failed' ||
        peerConnection.iceConnectionState === 'disconnected'
      ) {
        peerConnection.restartIce();
      } else if (peerConnection.iceConnectionState === 'connected') {
        // clearSystemMessage();
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'failed') {
        peerConnection.restartIce();
      } else if (peerConnection.connectionState === 'connected') {
        // clearSystemMessage();
      }
    };

    return peerConnection;
  };

  setUpDataChannel = ({ dataChannel, peerId, initiator }) => {
    dataChannel.onclose = () => {
      this.handlePeerLeaveSocket({ leavingUser: peerId });
    };

    dataChannel.onmessage = (event) => {
      handleData({ event, peerId });
    };

    dataChannel.onopen = () => {
      // clearSystemMessage();
      store.sendToPeer(dataChannel, {
        type: 'initPeer',
        data: {
          room: store.getCurrentRoom(),
          columnStart: $('#user .shadow').css('grid-column-start'),
          rowStart: $('#user .shadow').css('grid-row-start'),
        },
      });

      if (initiator && store.get('needRoomsInfo')) {
        store.sendToPeer(dataChannel, { type: 'requestRooms' });
      }
    };

    dataChannel.onerror = (event) => {};

    return dataChannel;
  };

  handleReceivedAnswer = async ({ fromSocket, answer }) => {
    await store
      .getPeer(fromSocket)
      .peerConnection.setRemoteDescription(
        new this._wrtc.RTCSessionDescription(answer)
      );
  };

  addCandidate = async ({ candidate, fromSocket }) => {
    try {
      await store.getPeer(fromSocket).peerConnection.addIceCandidate(candidate);
    } catch (e) {
      console.log('error adding received ice candidate', e);
    }
  };

  handleSocketError = (e) => {
    addSystemNotifyMessage(systemNotifyMsgError);
    console.log('Socket connection error', e, new Date().toLocaleTimeString());
  };

  handleSocketDisconnect = (e) => {
    addSystemNotifyMessage(systemNotifyMsgDisconnect);
    console.log('Disconnected from server', e, new Date().toLocaleTimeString());
    $('.participant').remove();
  };

  handlePeerLeaveSocket = ({ leavingUser }) => {
    $(`#peer-${leavingUser}`)
      .finish()
      .animate(
        { opacity: 0 },
        {
          complete: () => {
            $(`#peer-${leavingUser}`).remove();
            $(`#participant-${leavingUser}`).animate(
              { opacity: 0 },
              {
                complete: () => $(`#participant-${leavingUser}`).remove(),
              }
            );
            store.removePeer(leavingUser);
          },
        }
      );
  };

  send = (data) => {
    this.socket.emit(data.type, {
      ...data,
      fromSocket: this.socket.id,
    });
  };
}

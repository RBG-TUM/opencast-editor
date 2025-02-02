/**
 * Big thanks to Duncan "slampunk" Smith for writing this code and allowing it
 * to be used for this application.
 * duncan83@gmail.com
 */

import { AudioContext } from 'standardized-audio-context';

export function Waveform(opts) {
  this.audioContext = new AudioContext();
  this.oCanvas = document.createElement('canvas');
  this.buffer = {};
  this.WIDTH = 0;
  this.HEIGHT = 0;
  this.channelData = [];
  this.waveformImage = '';
  this.audioBuffer = null;

  this.aveRMS = 0;
  this.peakRMS = 0;

  this.numberSamples = 100000;
  this.waveformType = 'img';
  this.drawWaveform = this.drawCanvasWaveform;

  if (opts.width && opts.height) {
    this.setDimensions(opts.width, opts.height);
  }
  
  this.drawWaveform();
  if (opts.media) {
    this.generateWaveform(opts.media)
      .then(() => {
        //this.getAudioData();
        this.drawWaveform();
        if (this.waveformType !== 'svg') {
          _completeFuncs.forEach(fn => {
            fn(this.waveformImage || this.svgPath, this.waveformType);
          });
        }
      })
      .catch((e) => {
        console.log("Waveform Worker: " + e);
        this._error = e.toString()
        this.onerror.forEach(fn => fn(e.toString()));
      });
  }

  var _completeFuncs = [];
  Object.defineProperty(this, 'oncomplete', {
    get: function() {
      return _completeFuncs;
    },
    set: function(fn, opt) {
      if (typeof fn == 'function') {
        if (this.waveformImage || this.svgPath) {
          fn(this.waveformImage || this.svgPath, this.svgLength);
          return;
        }

        _completeFuncs.push(fn);
      }
    }
  });

  var _error = "";
  var _errorFuncs = [];
  Object.defineProperty(this, 'onerror', {
    get: function() {
      return _errorFuncs;
    },
    set: function(fn, opt) {
      if (typeof fn == 'function') {
        if (this._error && this._error !== "") {
          fn(_error);
          return;
        }
      }

      _errorFuncs.push(fn);
    }
  });
}

Waveform.prototype = {
  constructor: Waveform,
  setDimensions: function(width, height) {
    this.oCanvas.width = width;
    this.WIDTH = width;
    this.oCanvas.height = height;
    this.HEIGHT = height;
    this.ocCtx = this.oCanvas.getContext('2d');
  },
  decodeAudioData: function(arraybuffer) {
    return new Promise((resolve, reject) => {
      new Promise((res, rej) => {
        if (arraybuffer instanceof ArrayBuffer) {
          res(arraybuffer);
        }
        else if (arraybuffer instanceof Blob) {
          let reader = new FileReader();
          reader.onload = function() {
            res(reader.result);
          }
          reader.readAsArrayBuffer(arraybuffer);
        }
      })
      .then(buffer => {
        this.audioContext.decodeAudioData(buffer)
          .then(audiobuffer => {
            this.buffer = audiobuffer;
            resolve();
          })
          .catch(e => {
            reject(e);
          })
      })
      .catch(e => {
        reject(e);
      })
    })
  },
  getAudioData: function(buffer) {
    return;
    buffer = buffer || this.buffer;
    this.channelData = this.dropSamples(buffer.getChannelData(0), this.numberSamples);
  },
  drawCanvasWaveform: function(amp) {
    this.waveformImage = ``;
    return;
    amp = amp || 1;
    this.ocCtx.fillStyle = '#FFFFFF00';
    this.ocCtx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
    this.ocCtx.lineWidth = 1;
    this.ocCtx.strokeStyle = 'white';
    let sliceWidth = this.WIDTH * 1.0 / this.channelData.length;
    let x = 0;

    this.ocCtx.beginPath();
    this.ocCtx.moveTo(x, this.channelData[0] * this.HEIGHT / 128.0 / 2);

    this.channelData.forEach(sample => {
      let v = sample * amp;
      let y = this.HEIGHT * (1 + v) / 2;
      this.ocCtx.lineTo(x, y);
      this.aveRMS += sample * sample;
      this.peakRMS = Math.max(sample * sample, this.peakRMS);
      x += sliceWidth;
    });
    this.ocCtx.lineTo(this.WIDTH, this.HEIGHT/2);
    this.ocCtx.stroke();
    this.aveRMS = Math.sqrt(this.aveRMS / this.channelData.length);
    this.aveDBs = 20 * Math.log(this.aveRMS) / Math.log(10);
    this.waveformImage = this.oCanvas.toDataURL();
  },
  dropSamples: function(data, requestedLength) {
    let divider = Math.max(parseInt(data.length / requestedLength), 1);
    return data.filter((sample, i) => i % divider === 0);
  },
  generateWaveform: function(arraybuffer) {
    return new Promise((resolve, reject) => {});
    return this.decodeAudioData(arraybuffer);
  },
  delegateToWorker: function() {
    if (!this.worker) {
      this.worker = new Worker('../util/svgworker.js');
      this.worker.addEventListener('message', this.workerCommunication.bind(this), false);
      this.worker.postMessage(this.channelData);
    }
  },
  workerCommunication: function(e) {
    switch(e.data.type) {
      case 'path':
        this.setSVGpath(e.data.path, e.data.length);
        this.worker.removeEventListener('message', this.workerCommunication.bind(this), false);
        this.worker.terminate();
        this.worker = null;
        break;
      default:
        break;
    }
  },
  setSVGpath: function(path, len) {
    this.svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.svgLength = len;

    this.svgPath.setAttribute('d', path);
    this.svgPath.setAttribute('vector-effect', 'non-scaling-stroke');
    this.svgPath.setAttribute('stroke-width', '0.5px');

    this.oncomplete.forEach(fn => fn(this.svgPath, this.svgLength));
  }
};

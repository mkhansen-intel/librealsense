// Copyright (c) 2017 Intel Corporation. All rights reserved.
// Use of this source code is governed by an Apache 2.0 license
// that can be found in the LICENSE file.

'use strict';

/* global describe, it, before, after */
const assert = require('assert');
const rs2 = require('../index.js');

describe('Pipeline tests', function() {
  it('Default pipeline', () => {
    const pipe = new rs2.Pipeline();
    pipe.start();
    const frames = pipe.waitForFrames();
    assert.equal(frames.size > 0, true);
    pipe.stop();
    pipe.destroy();
  });

  it('Pipeline with context', () => {
    const ctx = new rs2.Context();
    const pipe = new rs2.Pipeline(ctx);
    pipe.start();
    const frames = pipe.waitForFrames();
    assert.equal(frames.size > 0, true);
    pipe.stop();
    pipe.destroy();
  });

  it('pipeline pollForFrames', () => {
    const ctx = new rs2.Context();
    const pipe = new rs2.Pipeline(ctx);
    pipe.start();
    let frames;
    while (!frames) {
      frames = pipe.pollForFrames();
      if (frames) {
        assert.equal((frames instanceof rs2.FrameSet), true);
      }
    }
    pipe.stop();
    pipe.destroy();
    ctx.destroy();
  });
});

describe('Frameset test', function() {
  let pipe;
  let frameset;

  before(function() {
    pipe = new rs2.Pipeline();
    pipe.start();
    frameset = pipe.waitForFrames();
  });

  after(function() {
    pipe.stop();
    pipe.destroy();
  });

  it('depthFrame test', () => {
    let depth = frameset.depthFrame;
    assert.equal(depth instanceof rs2.DepthFrame, true);
    let distance = depth.getDistance(100, 100);
    assert.equal(typeof distance, 'number');
  });

  it('colorFrame test', () => {
    let color = frameset.colorFrame;
    assert.equal(color instanceof rs2.VideoFrame, true);
  });

  it('at test', () => {
    for (let i=0; i<frameset.size; i++) {
      let frame = frameset.at(i);
      assert.equal(frame instanceof rs2.Frame, true);
    }
  });

  it('getFrame test', () => {
    let color = frameset.getFrame(rs2.stream.STREAM_COLOR);
    let depth = frameset.getFrame(rs2.stream.STREAM_DEPTH);
    assert.equal(color instanceof rs2.VideoFrame, true);
    assert.equal(depth instanceof rs2.DepthFrame, true);
  });
});

describe('Frame test', function() {
  let pipe;
  let frameset;
  let color;
  let depth;

  before(function() {
    pipe = new rs2.Pipeline();
    pipe.start();
    frameset = pipe.waitForFrames();
    color = frameset.colorFrame;
    depth = frameset.depthFrame;
  });

  after(function() {
    pipe.stop();
    pipe.destroy();
    pipe = undefined;
    frameset = undefined;
    color = undefined;
    depth = undefined;
  });

  it('format/stream/width/height/frameNumber/timestamp/isValid test', () => {
    assert.equal(depth.format, rs2.format.FORMAT_Z16);
    assert.equal(depth.streamType, rs2.format.STREAM_DEPTH);
    assert.equal(depth.isValid, true);
    assert.equal(depth.timestamp > 0, true);
    assert.equal(depth.frameNumber > 0, true);
    assert.equal(depth.width > 0, true);
    assert.equal(depth.height > 0, true);

    assert.equal(color.format, rs2.format.FORMAT_RGB8);
    assert.equal(color.streamType, rs2.format.STREAM_COLOR);
    assert.equal(color.isValid, true);
    assert.equal(color.timestamp > 0, true);
    assert.equal(color.frameNumber > 0, true);
    assert.equal(color.width > 0, true);
    assert.equal(color.height > 0, true);
  });

  it('frame metadata test', () => {
    for (let i=0; i<rs2.frame_metadata.FRAME_METADATA_COUNT; i++) {
      if (depth.supportsFrameMetadata(i)) {
        assert.equal(depth.frameMetadata(i) != undefined, true);
      }
      if (color.supportsFrameMetadata(i)) {
        assert.equal(color.frameMetadata(i) != undefined, true);
      }
    }
  });

  it('frame data test', () => {
    assert.equal(depth.data.length*2, depth.dataByteLength);
    assert.equal(color.data.length, color.dataByteLength);
  });

  it('strideInBytes test', () => {
    assert.equal(depth.strideInBytes, depth.width*2);
    assert.equal(color.strideInBytes, color.width*3);
  });

  it('getData test', () => {
    const buf1 = new ArrayBuffer(depth.dataByteLength);
    depth.getData(buf1);
    const buf2 = Buffer.from(buf1);
    const buf3 = Buffer.from(depth.data.buffer);
    assert.equal(buf3.equals(buf2), true);
    const buf21 = new ArrayBuffer(color.dataByteLength);
    color.getData(buf21);
    const buf22 = Buffer.from(buf21);
    const buf23 = Buffer.from(color.data.buffer);
    assert.equal(buf23.equals(buf22), true);
  });
});

describe('Colorizer test', function() {
  let pipe;
  let frameset;
  let depth;
  let colorizer;

  before(function() {
    pipe = new rs2.Pipeline();
    pipe.start();
    frameset = pipe.waitForFrames();
    depth = frameset.depthFrame;
    colorizer = new rs2.Colorizer();
  });

  after(function() {
    pipe.stop();
    pipe.destroy();
    colorizer.destroy();
    pipe = undefined;
    frameset = undefined;
    depth = undefined;
    colorizer = undefined;
  });

  it('colorize test', () => {
    const depthRGB = colorizer.colorize(depth);
    assert.equal(depthRGB.height, depth.height);
    assert.equal(depthRGB.width, depth.width);
    assert.equal(depthRGB.format, rs2.format.FORMAT_RGB8);
  });
});


describe('Pointcloud and Points test', function() {
  let pipe;
  let frameset;
  let color;
  let depth;
  let pc;
  let ctx;

  before(function() {
    ctx = new rs2.Context();
    pc = new rs2.PointCloud();
    pipe = new rs2.Pipeline(ctx);
    pipe.start();
    frameset = pipe.waitForFrames();
    color = frameset.colorFrame;
    depth = frameset.depthFrame;
  });

  after(function() {
    pipe.stop();
    pipe.destroy();
    pc.destroy();
    ctx.destroy();
    pc = undefined;
    ctx = undefined;
    pipe = undefined;
    frameset = undefined;
    color = undefined;
    depth = undefined;
  });

  it('map and calculate test', () => {
    assert.equal(pc instanceof rs2.PointCloud, true);

    pc.mapTo(color);
    const points = pc.calculate(depth);
    const cnt = depth.width*depth.height;
    assert.equal(points instanceof rs2.Points, true);
    assert.equal(points.size, cnt);
    const texCoordinates = points.textureCoordinates;

    assert.equal(points.vertices instanceof Float32Array, true);
    assert.equal(texCoordinates instanceof Int32Array, true);

    assert.equal(points.vertices.length, cnt*3);
    assert.equal(texCoordinates.length, cnt*2);
  });
});

describe('Context tests', function() {
  let ctx;

  before(() => {
    ctx = new rs2.Context();
  });

  after(() => {
    ctx.destroy();
  });

  it('Query devices', () => {
    const devList = ctx.queryDevices();
    assert.equal(devList instanceof rs2.DeviceList, true);
    assert.equal(devList.size, 1);
    assert.equal(devList.devices[0] instanceof rs2.Device, true);
    assert.equal(devList.contains(devList.devices[0]), true);
    devList.destroy();
  });

  it('Query sensors', () => {
    const sensors = ctx.querySensors();

    assert.equal(sensors.length, 2);
    assert.equal(sensors[0] instanceof rs2.Sensor, true);
    assert.equal(sensors[1] instanceof rs2.Sensor, true);
    sensors.forEach((sensor) => {
      sensor.destroy();
    });
  });

  it('Get sensor parent', () => {
    const sensors = ctx.querySensors();
    const dev = ctx.getSensorParent(sensors[0]);
    assert.equal(dev instanceof rs2.Device, true);
    sensors.forEach((sensor) => {
      sensor.destroy();
    });
  });
});

describe('Sensor tests', function() {
  let ctx;
  let sensors;

  before(() => {
    ctx = new rs2.Context();
    sensors = ctx.querySensors();
  });

  after(() => {
    ctx.destroy();
    sensors.forEach((sensor) => {
      sensor.destroy();
    });
    ctx = undefined;
    sensors = undefined;
  });

  it('Stream profiles', () => {
    const profiles0 = sensors[0].getStreamProfiles();
    const profiles1 = sensors[1].getStreamProfiles();

    assert.equal(profiles1.length > 0, true);
    assert.equal(profiles0.length > 0, true);
    profiles0.forEach((p) => {
      assert.equal(p instanceof rs2.StreamProfile, true);
      assert.equal(p instanceof rs2.StreamProfile, true);
      assert.equal(p.streamType >= rs2.stream.STREAM_DEPTH &&
                   p.streamType < rs2.stream.STREAM_COUNT, true);
      assert.equal(p.format >= rs2.format.FORMAT_Z16 && p.format < rs2.format.FORMAT_COUNT, true);
      assert.equal(p.fps>0, true);
      assert.equal(typeof p.uniqueID, 'number');
      assert.equal(typeof p.isDefault, 'boolean');
    });
    profiles1.forEach((p) => {
      assert.equal(p instanceof rs2.StreamProfile, true);
      assert.equal(p instanceof rs2.StreamProfile, true);
    });
    const extrin = profiles0[0].getExtrinsicsTo(profiles1[0]);
    assert.equal(('rotation' in extrin), true);
    assert.equal(('translation' in extrin), true);

    profiles0.forEach((p) => {
      if (p instanceof rs2.VideoStreamProfile) {
        assert.equal(typeof p.width, 'number');
        assert.equal(typeof p.height, 'number');
        const intrin = p.getIntrinsics();
        assert.equal('width' in intrin, true);
        assert.equal('height' in intrin, true);
        assert.equal('ppx' in intrin, true);
        assert.equal('ppy' in intrin, true);
        assert.equal('fx' in intrin, true);
        assert.equal('fy' in intrin, true);
        assert.equal('model' in intrin, true);
        assert.equal('coeffs' in intrin, true);

        assert.equal(typeof intrin.width, 'number');
        assert.equal(typeof intrin.height, 'number');
        assert.equal(typeof intrin.ppx, 'number');
        assert.equal(typeof intrin.ppy, 'number');
        assert.equal(typeof intrin.fx, 'number');
        assert.equal(typeof intrin.fy, 'number');
        assert.equal(typeof intrin.model, 'number');
        assert.equal(Array.isArray(intrin.coeffs), true);
      }
    });
  });

  it('Open and start', () => {
    return new Promise((resolve, reject) => {
      const profiles0 = sensors[0].getStreamProfiles();
      sensors[0].open(profiles0[0]);
      sensors[0].start((frame) => {
        assert.equal(frame instanceof rs2.Frame, true);
        sensors[0].stop();
        sensors[0].close();
        resolve();
      });
    });
  });
  it('Get depth scale', () => {
    for (let i = 0; i < sensors.length; i++) {
      if (sensors[i] instanceof rs2.DepthSensor) {
        assert.equal(typeof sensors[i].depthScale === 'number', true);
      }
    }
  });
  it('getOptionDescription', () => {
    sensors.forEach((s) => {
      for (let i = rs2.option.OPTION_BACKLIGHT_COMPENSATION; i < rs2.option.OPTION_COUNT; i++) {
        let des = s.getOptionDescription(i);
        assert.equal((des === undefined) || (typeof des === 'string'), true);
      }
    });
  });
  it('getOption', () => {
    sensors.forEach((s) => {
      for (let i = rs2.option.OPTION_BACKLIGHT_COMPENSATION; i < rs2.option.OPTION_COUNT; i++) {
        let value = s.getOption(i);
        assert.equal((value === undefined) || (typeof value === 'number'), true);
      }
    });
  });
  it('getOptionValueDescription', () => {
    sensors.forEach((s) => {
      for (let i = rs2.option.OPTION_BACKLIGHT_COMPENSATION; i < rs2.option.OPTION_COUNT; i++) {
        let des = s.getOptionValueDescription(i, 1);
        assert.equal((des === undefined) || (typeof des === 'string'), true);
      }
    });
  });
  it('setOption', () => {
    sensors.forEach((s) => {
      for (let i = rs2.option.OPTION_BACKLIGHT_COMPENSATION; i < rs2.option.OPTION_COUNT; i++) {
        if (s.supportsOption(i) && !s.isOptionReadOnly(i)) {
          let range = s.getOptionRange(i);
          for (let j = range.minvalue; j <= range.maxValue; j += range.step) {
            s.setOption(i, j);
            let val = s.getOption(i);
            assert.equal(val, j);
          }
        }
      }
    });
  });
  it('Notification test', () => {
    return new Promise((resolve, reject) => {
      let dev = ctx.queryDevices().devices[0];
      setTimeout(() => {
        dev.cxxDev.triggerErrorForTest();
      }, 500);
      sensors[0].setNotificationsCallback((n) => {
        assert.equal(typeof n.descr, 'string');
        assert.equal(typeof n.timestamp, 'number');
        assert.equal(typeof n.severity, 'number');
        assert.equal(typeof n.category, 'number');
        resolve();
      });
    });
  });
});

describe('Align tests', function() {
  let ctx;
  let align;
  let pipe;

  before(() => {
    ctx = new rs2.Context();
    align = new rs2.Align(rs2.stream.STREAM_COLOR);
    pipe = new rs2.Pipeline();
  });

  after(() => {
    pipe.stop();
    pipe.destroy();
    align.destroy();
    ctx.destroy();
    ctx = undefined;
    align = undefined;
    pipe = undefined;
  });

  it('process', () => {
    pipe.start();
    const frameset = pipe.waitForFrames();
    const output = align.process(frameset);
    const color = output.colorFrame;
    const depth = output.depthFrame;
    assert.equal(color instanceof rs2.VideoFrame, true);
    assert.equal(depth instanceof rs2.DepthFrame, true);
  });
});

describe(('syncer test'), function() {
  let syncer;
  let ctx;
  let sensors;

  before(() => {
    ctx = new rs2.Context();
    syncer = new rs2.Syncer();
    sensors = ctx.querySensors();
  });

  after(() => {
    sensors.forEach((s) => {
      s.stop();
      s.destroy();
    });
    ctx.destroy();
    syncer.destroy();
  });
  it('sensor.start(syncer)', () => {
    const profiles = sensors[0].getStreamProfiles();
    sensors[0].open(profiles[0]);
    sensors[0].start(syncer);

    let frames = syncer.waitForFrames(5000);
    assert.equal(frames instanceof rs2.FrameSet, true);
    let gotFrame = false;
    while (!gotFrame) {
      let frames = syncer.pollForFrames();
      if (frames) {
        assert.equal(frames instanceof rs2.FrameSet, true);
        gotFrame = true;
      }
    }
    profiles.forEach((p) => {
      p.destroy();
    });
  });
});

describe('Config test', function() {
  let pipe;
  let cfg;
  let ctx;

  before(function() {
    ctx = new rs2.Context();
    pipe = new rs2.Pipeline(ctx);
    cfg = new rs2.Config();
  });

  after(function() {
    pipe.stop();
    pipe.destroy();
    ctx.destroy();
  });

  it('resolve test', function() {
    assert.equal(cfg.canResolve(pipe), true);
    const profile = cfg.resolve(pipe);
    assert.equal(profile instanceof rs2.PipelineProfile, true);
    const dev = profile.getDevice();
    assert.equal(dev instanceof rs2.Device, true);
    const profiles = profile.getStreams();
    assert.equal(Array.isArray(profiles), true);
    assert.equal(profiles[0] instanceof rs2.StreamProfile, true);
    profiles.forEach((p) => {
      p.destroy();
    });
    dev.destroy();
  });

  it('enableStream test', function() {
    cfg.disableAllStreams();
    cfg.enableStream(rs2.stream.STREAM_COLOR, -1, 640, 480, rs2.format.FORMAT_RGB8, 30);
    const profile = cfg.resolve(pipe);
    assert.equal(profile instanceof rs2.PipelineProfile, true);
    const profiles = profile.getStreams();
    assert.equal(Array.isArray(profiles), true);
    assert.equal(profiles.length, 1);
    assert.equal((profiles[0] instanceof rs2.VideoStreamProfile), true);
    assert.equal(profiles[0].streamType, rs2.stream.STREAM_COLOR);
    assert.equal(profiles[0].format, rs2.format.FORMAT_RGB8);
    assert.equal(profiles[0].width, 640);
    assert.equal(profiles[0].height, 480);
    assert.equal(profiles[0].fps, 30);

    const startProfile = pipe.start(cfg);
    const startProfiles = startProfile.getStreams();
    assert.equal(Array.isArray(startProfiles), true);
    assert.equal(startProfiles.length, 1);
    assert.equal((startProfiles[0] instanceof rs2.VideoStreamProfile), true);
    assert.equal(startProfiles[0].streamType, rs2.stream.STREAM_COLOR);
    assert.equal(startProfiles[0].format, rs2.format.FORMAT_RGB8);
    assert.equal(startProfiles[0].width, 640);
    assert.equal(startProfiles[0].height, 480);
    assert.equal(startProfiles[0].fps, 30);

    const activeProfile = pipe.getActiveProfile();
    const activeProfiles = activeProfile.getStreams();
    assert.equal(Array.isArray(activeProfiles), true);
    assert.equal(activeProfiles.length, 1);
    assert.equal((activeProfiles[0] instanceof rs2.VideoStreamProfile), true);
    assert.equal(activeProfiles[0].streamType, rs2.stream.STREAM_COLOR);
    assert.equal(activeProfiles[0].format, rs2.format.FORMAT_RGB8);
    assert.equal(activeProfiles[0].width, 640);
    assert.equal(activeProfiles[0].height, 480);
    assert.equal(activeProfiles[0].fps, 30);

    profiles.forEach((p) => {
      p.destroy();
    });
    activeProfiles.forEach((p) => {
      p.destroy();
    });
    startProfiles.forEach((p) => {
      p.destroy();
    });
  });
});

describe(('DeviceHub test'), function() {
  let hub;
  let ctx;

  before(() => {
    ctx = new rs2.Context();
    hub = new rs2.DeviceHub(ctx);
  });

  after(() => {
    hub.destroy();
    ctx.destroy();
  });
  it('API test', () => {
    const dev = hub.waitForDevice();
    assert.equal(dev instanceof rs2.Device, true);
    assert.equal(hub.isConnected(dev), true);
    dev.destroy();
  });
});

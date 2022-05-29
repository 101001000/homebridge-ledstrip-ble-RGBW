const noble = require("@abandonware/noble");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hslToRgb(h, s, l){
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

module.exports = class Device {
//class Device {
	
  constructor(uuid) {
	  
    this.uuid = uuid;
    this.connected = false;
    this.power = false;
    this.brightness = 100;
    this.hue = 0;
    this.saturation = 100;
    this.l = 0.5;
    this.peripheral = undefined;
	this.chars = undefined;

    noble.on("stateChange", state => {
      console.log("State:", state);
      if (state == "poweredOn") {
        noble.startScanningAsync();
      } else {
        // if (this.peripheral) this.peripheral.disconnect();
        this.connected = false;
      }
    });

    noble.on("discover", async peripheral => {
      console.log("discover, ", peripheral.uuid, peripheral.advertisement.localName);
      if (peripheral.uuid == this.uuid) {
        this.peripheral = peripheral;
        noble.stopScanning();
		
		await sleep(1000);
		await this.connect();
		await sleep(1000);
		
		const { characteristics } =
		  await this.peripheral.discoverSomeServicesAndCharacteristicsAsync(
			["ffe5"],
			["ffe9"]
		  );
		console.log("Characteristics: ", characteristics);
		this.chars = characteristics[0];		
      }
    });
  }
  
  async connect(){
	console.log("Connecting...");
	await this.peripheral.connectAsync();
	this.connected = true;
	console.log("Connected!");
  }

  async disconnect() {
	console.log("Disconnecing...");
    if (this.peripheral) {
      await this.peripheral.disconnectAsync();
      this.connected = false;
    }
  }
  
  async set_power(status) {
	console.log("set_power called, no action");
	return;
  }

  async set_brightness(level) {
	if (!this.connected) await this.connect();
	this.brightness = level;
	const rgb = hslToRgb(this.hue / 360, this.saturation / 100, this.l);
    this.set_rgb(rgb[0], rgb[1], rgb[2]);
  }

  async set_saturation(level) {
	if (!this.connected) await this.connect();
	this.saturation = level;
	const rgb = hslToRgb(this.hue / 360, this.saturation / 100, this.l);
    this.set_rgb(rgb[0], rgb[1], rgb[2]);
  }

  async set_hue(level) {
	if (!this.connected) await this.connect();
	this.hue = level;
	const rgb = hslToRgb(this.hue / 360, this.saturation / 100, this.l);
    this.set_rgb(rgb[0], rgb[1], rgb[2]);
  }

  async set_rgb(r, g, b) {
    if (!this.connected) await this.connect();
		
    const rhex = ("0" + (r*this.brightness/100.0).toString(16)).slice(-2);
    const ghex = ("0" + (g*this.brightness/100.0).toString(16)).slice(-2);
    const bhex = ("0" + (b*this.brightness/100.0).toString(16)).slice(-2);

    const buffer = Buffer.from(`56${rhex}${ghex}${bhex}00F0AA`, "hex");
    
	console.log("Write:", buffer);
    this.chars.write(buffer, true, err => {
		if (err) console.log("Error:", err);
    });
  }
}

//dev = new Device("ffff80048c15");

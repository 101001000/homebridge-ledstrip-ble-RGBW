const noble = require("@abandonware/noble");

function clamp(n, a, b){
	if(n < a) return a;
	if(n > b) return b;
	return n;
}

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
	
  constructor(uuid) {
	
    this.peripheral = undefined;
	this.chars = undefined;
    this.uuid = uuid;
    this.connected = false;
    this.power = false;
	
	this.oldbrightness = 100;
    this.brightness = 100;
	
    this.hue = 0;
    this.saturation = 100;
	this.c = 1;
	this.w = 1;

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
	this.power = status;
	if (status){
		this.set_brightness(this.oldbrightness);
	} else {
		this.oldbrightness = this.brightness;
		this.set_brightness(0);
	}
  }

  async set_brightness(level) {
	this.brightness = level;
	if (!this.connected) await this.connect();
	const rgb = hslToRgb(this.hue / 360, 1, 0.5);
    this.set_rgb(rgb[0], rgb[1], rgb[2]);
  }

  async set_saturation(level) {
	this.saturation = level;
	
	this.w = clamp(1-(this.saturation/100.0), 0, 0.5)*2;
	this.c = clamp(this.saturation/100.0, 0, 0.5)*2;
	
	if (!this.connected) await this.connect();
	const rgb = hslToRgb(this.hue / 360, 1, 0.5);
    this.set_rgb(rgb[0], rgb[1], rgb[2]);
  }

  async set_hue(level) {
	this.hue = level;
	if (!this.connected) await this.connect();
	const rgb = hslToRgb(this.hue / 360, 1, 0.5);
    this.set_rgb(rgb[0], rgb[1], rgb[2]);
  }

  async set_rgb(r, g, b) {
    if (!this.connected) await this.connect();
		
	var f = (this.brightness/100.0);
		
    const rhex = ("0" + parseInt(r*f*this.c).toString(16)).slice(-2);
    const ghex = ("0" + parseInt(g*f*this.c).toString(16)).slice(-2);
    const bhex = ("0" + parseInt(b*f*this.c).toString(16)).slice(-2);
	
	const whex = ("0" + parseInt(255.0*f*this.w).toString(16)).slice(-2);

    const bufferC = Buffer.from(`56${rhex}${ghex}${bhex}00F0AA`, "hex");
    const bufferW = Buffer.from(`56000000${whex}0FAA`, "hex");
	
	console.log("Write color:", bufferC);
    this.chars.write(bufferC, true, err => {
		if (err) console.log("Error:", err);
    });
	
	console.log("Write white:", bufferW);
    this.chars.write(bufferW, true, err => {
		if (err) console.log("Error:", err);
    });
  }
}
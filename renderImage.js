if (!process.argv[2]) {
  console.error('Usage: node renderImage.js item-name')
  process.exit(1);
}

const path = require('path');

const puppeteer = require('puppeteer');
const fs = require('fs');
const { spawn } = require('child_process');
const sharp = require('sharp');

const httpServer = spawn('node', [path.dirname(process.argv[1]) + '/node_modules/.bin/http-server', '-p', '8095', '-a', '127.0.0.1']);

let serverOuts = 0;
let renderStarted = false;

httpServer.stdout.on( 'data', data => {
  serverOuts++;

  console.log( `stdout: ${data}` );

  if (serverOuts >= 2) {
    if (!renderStarted) {
      renderStarted = true;
      puppeteerRender();
    }
  }
});

httpServer.stderr.on( 'data', data => {
  console.log( `stderr: ${data}` );
});

httpServer.on( 'close', code => {
  console.log( `child process exited with code ${code}` );
} );

process.on('exit', function() {
  httpServer.kill();
});

function shutdown(code) {
  httpServer.kill();
  process.exit(code)
}

function puppeteerRender() {
  (async() => {
    try {
      const browser = await puppeteer.launch({
    headless: false
  });
      const page = await browser.newPage();

      // Set the initial viewport tiny to minimize the RAM-Seconds
      await page.setViewport({
        width: 200,
        height: 200,
      });

      let url = 'http://127.0.0.1:8095/index.html#pixelRatioLimit1';
      await page.goto(url, {waitUntil: 'networkidle2'});
      await page.waitFor('#BabylonFinishedIndicator');

      await page.waitFor(100);
      await page.setViewport({
        width: 1920*2,
        height: 1080*2,
      });
      await page.waitFor(100);
      const rawScreenshot = await page.screenshot({
      });
      await page.waitFor(1);
      await browser.close();

      // If webGL crashes, then a 8k white image is only 130kB
      if (rawScreenshot.length < 150000) {
        throw new Error('WebGL crashed')
      }

      var formats = [{
        filename: './output/' + process.argv[2] + '-4k.jpg',
        x: 3840,
        y: 2160,
      },{
        filename: './output/' + process.argv[2] + '-1080.jpg',
        x: 1920,
        y: 1080,
      },{
        filename: './output/' + process.argv[2] + '-small.jpg',
        x: 1280,
        y: 720,
      }];

      for (let i in formats) {
        let format = formats[i];

        await sharp(rawScreenshot,{}).jpeg({
          quality: 80,
        }).resize(format.x, format.y).toFile(format.filename);
        console.log('Rendered file to ' + format.filename)
      }

      shutdown(0);
    } catch(e) {
      console.error(e);
      shutdown(1);
    }
  })();
}


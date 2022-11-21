# How to Configure Adafruit Pyportal?
These are the instructions to setup your Adafruit Pyportal for this demo

## References
Adafruit Pyortal documentation: [Adafruit PyPortal - IoT for CircuitPython](https://learn.adafruit.com/adafruit-pyportal)

## Setup
1. Connect your PyPortal device to your computer with a USB cable.
2. Follow [these instructions](https://learn.adafruit.com/adafruit-pyportal/update-the-uf2-bootloader) to update the UF2
bootloader on your PyPortal to the latest version
2. As per the documentation "to use your PyPortal with AWS IoT, you'll need to update the ESP32's firmware to the latest 
version of nina-fw." Follow the instruction on 
[this page](https://learn.adafruit.com/upgrading-esp32-firmware/upgrade-all-in-one-esp32-airlift-firmware)
to download the UF2 file for the Pyportal device and update the firmware.
3. Follow [these instructions](https://learn.adafruit.com/adafruit-pyportal/install-circuitpython) to install 
CircuitPython 7.3.3 on the PyPortal.
4. From [this page](https://circuitpython.org/libraries) download the `Bundle for Version 7.x` full bundle of 
CircuitPython 7.x libraries. Store the file on you computer and unzip the file. Copy-paste the entire content of the
`lib` folder to the `/lib` folder on the PyPortal, replacing all existing files.
4. Copy the content of this repository's `/resources/adafruit` folder to the PyPortal's `CIRCUITPY` drive.
5. Once you have deployed the CDK stack, go into the AWS console in the `Systems Manager` service and select the 
`Parameter Store`. You will find the content of both the Iot certificate and the Iot private key. Copy the content of
these parameters as follow:
    * Copy the content of the `/iot/certs/chaos-game-xxxxxx-monster/certPem` into the empty `aws_cert.pem.crt` file
    * Copy the content of the `/iot/certs/chaos-game-xxxxxx-monster/privKey` into the empty `private.pem.key` file
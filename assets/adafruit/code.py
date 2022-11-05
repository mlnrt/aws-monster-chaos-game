# SPDX-FileCopyrightText: Minesweeper: 2019 Dave Astels for Adafruit Industries
# SPDX-FileCopyrightText: AWS IoT Plant Monitor: 2019 Brent Rubell for Adafruit Industries
#
# SPDX-License-Identifier: MIT

"""
PyPortal MineSweeper
=========================================================
Adafruit invests time and resources providing this open source code.
Please support Adafruit and open source hardware by purchasing
products from Adafruit!

Written by Dave Astels for Adafruit Industries
Copyright (c) 2019 Adafruit Industries
Licensed under the MIT license.

All text above must be included in any redistribution.
=========================================================
PyPortal Amazon AWS IoT Plant Monitor
=========================================================
Log your plant's vitals to AWS IoT and receive email
notifications when it needs watering with your PyPortal.

Author: Brent Rubell for Adafruit Industries, 2019
"""

import time
import json
import busio
from random import seed, randint
import board
import digitalio
import displayio
import audioio
try:
    from audioio import WaveFile
except ImportError:
    from audiocore import WaveFile

import adafruit_imageload
import adafruit_touchscreen

# For AWS IoT

import neopixel
from adafruit_esp32spi import adafruit_esp32spi
from adafruit_esp32spi import adafruit_esp32spi_wifimanager
import adafruit_esp32spi.adafruit_esp32spi_socket as socket
import adafruit_minimqtt.adafruit_minimqtt as MQTT
from adafruit_aws_iot import MQTT_CLIENT
from adafruit_seesaw.seesaw import Seesaw

# =========================================================
# Display and Audio Config
# =========================================================
display = board.DISPLAY
disply_group_iot = displayio.Group()

display.show(disply_group_iot)

# Set up audio
speaker_enable = digitalio.DigitalInOut(board.SPEAKER_ENABLE)
speaker_enable.switch_to_output(False)
if hasattr(board, 'AUDIO_OUT'):
    audio = audioio.AudioOut(board.AUDIO_OUT)
elif hasattr(board, 'SPEAKER'):
    audio = audioio.AudioOut(board.SPEAKER)
else:
    raise AttributeError('Board does not have a builtin speaker!')
# =========================================================
# AWS IoT Config
# =========================================================
# Get wifi details and more from a secrets.py file
try:
    from secrets import secrets
except ImportError:
    print("WiFi secrets are kept in secrets.py, please add them there!")
    raise

# Get device certificate
try:
    with open("aws_cert.pem.crt", "rb") as f:
        DEVICE_CERT = f.read()
except ImportError:
    print("Certificate (aws_cert.pem.crt) not found on CIRCUITPY filesystem.")
    raise

# Get device private key
try:
    with open("private.pem.key", "rb") as f:
        DEVICE_KEY = f.read()
except ImportError:
    print("Key (private.pem.key) not found on CIRCUITPY filesystem.")
    raise

# If you are using a board with pre-defined ESP32 Pins:
esp32_cs = digitalio.DigitalInOut(board.ESP_CS)
esp32_ready = digitalio.DigitalInOut(board.ESP_BUSY)
esp32_reset = digitalio.DigitalInOut(board.ESP_RESET)

spi = busio.SPI(board.SCK, board.MOSI, board.MISO)
esp = adafruit_esp32spi.ESP_SPIcontrol(spi, esp32_cs, esp32_ready, esp32_reset)

# Verify nina-fw version >= 1.4.0
assert int(bytes(esp.firmware_version).decode("utf-8")[2]) >= 4, "Please update nina-fw to >=1.4.0."

status_light = neopixel.NeoPixel(board.NEOPIXEL, 1, brightness=0.2)
wifi = adafruit_esp32spi_wifimanager.ESPSPI_WiFiManager(
    esp, secrets, status_light)

# Initialize the graphics helper
print("Loading AWS IoT Graphics...")
aws_iot_splash_screen_file = open("/images/aws_splash.bmp", "rb")
aws_iot_splash_screen = displayio.OnDiskBitmap(aws_iot_splash_screen_file)
aws_iot_splash_screen_sprite = displayio.TileGrid(
    aws_iot_splash_screen,
    pixel_shader=getattr(aws_iot_splash_screen, 'pixel_shader', displayio.ColorConverter()))
disply_group_iot.append(aws_iot_splash_screen_sprite)
print("Graphics loaded!")

# Set AWS Device Certificate
esp.set_certificate(DEVICE_CERT)

# Set AWS RSA Private Key
esp.set_private_key(DEVICE_KEY)

# Connect to WiFi
print("Connecting to WiFi...")
wifi.connect()
print("Connected!")

# Initialize MQTT interface with the esp interface
MQTT_TOPIC = "monster-chaos-game/monster"
MQTT.set_socket(socket, esp)

# Set up a new MiniMQTT Client
client = MQTT.MQTT(broker = secrets['broker'],
                   client_id = secrets['client_id'])

# =========================================================
# IoT Functions
# =========================================================
# Define callback methods which are called when events occur
# pylint: disable=unused-argument, redefined-outer-name
def connect(client, userdata, flags, rc):
    # This function will be called when the client is connected
    # successfully to the broker.
    print('Connected to AWS IoT!')
    print('Flags: {0}\nRC: {1}'.format(flags, rc))

    # Subscribe client to all shadow updates
    print("Subscribing to shadow updates...")
    aws_iot.subscribe(MQTT_TOPIC)

def disconnect(client, userdata, rc):
    # This method is called when the client disconnects
    # from the broker.
    print('Disconnected from AWS IoT!')

def subscribe(client, userdata, topic, granted_qos):
    # This method is called when the client subscribes to a new topic.
    print('Subscribed to {0} with QOS level {1}'.format(topic, granted_qos))

def unsubscribe(client, userdata, topic, pid):
    # This method is called when the client unsubscribes from a topic.
    print('Unsubscribed from {0} with PID {1}'.format(topic, pid))

def publish(client, userdata, topic, pid):
    # This method is called when the client publishes data to a topic.
    print('Published to {0} with PID {1}'.format(topic, pid))

def message(client, topic, msg):
    # This method is called when the client receives data from a topic.
    print("Message from {}: {}".format(topic, msg))

# Initialize AWS IoT MQTT API Client
aws_iot = MQTT_CLIENT(client, keep_alive=180)

# Connect callback handlers to AWS IoT MQTT Client
aws_iot.on_connect = connect
aws_iot.on_disconnect = disconnect
aws_iot.on_subscribe = subscribe
aws_iot.on_unsubscribe = unsubscribe
aws_iot.on_publish = publish
aws_iot.on_message = message

print('Attempting to connect to %s'%client.broker)
aws_iot.connect()

# =========================================================
# Game Config
# =========================================================
seed(int(time.monotonic()))

NUMBER_OF_MONSTERS = 10
NUMBER_OF_MONSTER_TYPES = 4

# Board pieces

OPEN0 = 0
OPEN1 = 1
OPEN2 = 2
OPEN3 = 3
OPEN4 = 4
OPEN5 = 5
OPEN6 = 6
OPEN7 = 7
OPEN8 = 8
BLANK = 9
MONSTERFLAGGED = 11
MONSTERMISFLAGGED = 12
MONSTERQUESTION = 13
MONSTERS = [16, 17, 18, 19]
MONSTERDEATH = [20, 21, 22, 23]
TILE_PIX_SIZE = 32
NB_X_TILES = 10
NB_Y_TILES = 7

sprite_sheet, palette = adafruit_imageload.load("/images/SpriteSheet.bmp",
                                                bitmap=displayio.Bitmap,
                                                palette=displayio.Palette)
display_group_game = displayio.Group()
touchscreen = adafruit_touchscreen.Touchscreen(board.TOUCH_XL, board.TOUCH_XR,
                                               board.TOUCH_YD, board.TOUCH_YU,
                                               calibration=((9000, 59000),
                                                            (8000, 57000)),
                                               size=(display.width, display.height))

tilegrid = displayio.TileGrid(sprite_sheet, pixel_shader=palette,
                              width=NB_X_TILES, height=NB_Y_TILES,
                              tile_height=TILE_PIX_SIZE, tile_width=TILE_PIX_SIZE,
                              default_tile=BLANK)
display_group_game.append(tilegrid)
display.show(display_group_game)

board_data = bytearray(b'\x00' * NB_X_TILES * NB_Y_TILES)

# =========================================================
# Game Functions
# =========================================================
#pylint:disable=redefined-outer-name
def get_data(x, y):
    return board_data[y * NB_X_TILES + x]

def set_data(x, y, value):
    board_data[y * NB_X_TILES + x] = value
#pylint:disable=redefined-outer-name

def seed_monsters(how_many):
    for _ in range(how_many):
        while True:
            monster_x = randint(0, NB_X_TILES-1)
            monster_y = randint(0, NB_Y_TILES-1)
            monster_type = 15 + randint(1, NUMBER_OF_MONSTER_TYPES)
            if get_data(monster_x, monster_y) == 0:
                set_data(monster_x, monster_y, monster_type)
                break

def compute_counts():
    """For each monster, increment the count in each non-monster square around it"""
    for y in range(NB_Y_TILES):
        for x in range(NB_X_TILES):
            if get_data(x, y) not in MONSTERS:
                continue                  # keep looking for monsters
            for dx in (-1, 0, 1):
                if x + dx < 0 or x + dx >= NB_X_TILES:
                    continue              # off screen
                for dy in (-1, 0, 1):
                    if y + dy < 0 or y + dy >= NB_Y_TILES:
                        continue          # off screen
                    count = get_data(x + dx, y + dy)
                    if count in MONSTERS:
                        continue          # don't process monsters
                    set_data(x + dx, y + dy, count + 1)

def reveal():
    for x in range(NB_X_TILES):
        for y in range(NB_Y_TILES):
            if tilegrid[x, y] == MONSTERFLAGGED and get_data(x, y) not in MONSTERS:
                tilegrid[x, y] = MONSTERMISFLAGGED
            else:
                tilegrid[x, y] = get_data(x, y)

#pylint:disable=too-many-nested-blocks
def expand_uncovered(start_x, start_y):
    number_uncovered = 1
    stack = [(start_x, start_y)]
    while len(stack) > 0:
        x, y = stack.pop()
        if tilegrid[x, y] == BLANK:
            under_the_tile = get_data(x, y)
            if under_the_tile <= OPEN8:
                tilegrid[x, y] = under_the_tile
                number_uncovered += 1
                if under_the_tile == OPEN0:
                    for dx in (-1, 0, 1):
                        if x + dx < 0 or x + dx >= NB_X_TILES:
                            continue              # off screen
                        for dy in (-1, 0, 1):
                            if y + dy < 0 or y + dy >= NB_Y_TILES:
                                continue          # off screen
                            if dx == 0 and dy == 0:
                                continue          # don't process where the monster
                            stack.append((x + dx, y + dy))
    return number_uncovered
#pylint:enable=too-many-nested-blocks

def check_for_win():
    """Check for a complete, winning game. That's one with all squares uncovered
    and all monsters correctly flagged, with no non-monster squares flaged.
    """
    # first make sure everything has been explored and decided
    for x in range(NB_X_TILES):
        for y in range(NB_Y_TILES):
            if tilegrid[x, y] == BLANK or tilegrid[x, y] == MONSTERQUESTION:
                return None               #still ignored or question squares
    # then check for mistagged monsters
    for x in range(NB_X_TILES):
        for y in range(NB_Y_TILES):
            if tilegrid[x, y] == MONSTERFLAGGED and get_data(x, y) not in MONSTERS:
                return False               #misflagged monsters, not done
    return True               #nothing unexplored, and no misflagged monsters

#pylint:disable=too-many-branches
# This could be broken apart but I think it's more understandable
# with it all in one place
def play_a_game():
    number_uncovered = 0
    touch_x = -1
    touch_y = -1
    touch_time = 0
    wait_for_release = False
    while True:
        now = time.monotonic()
        if now >= touch_time:
            touch_time = now + 0.2
            # process touch
            touch_at = touchscreen.touch_point
            if touch_at is None:
                wait_for_release = False
            else:
                if wait_for_release:
                    continue
                wait_for_release = True
                touch_x = max(min([touch_at[0] // TILE_PIX_SIZE, NB_X_TILES-1]), 0)
                touch_y = max(min([touch_at[1] // TILE_PIX_SIZE, NB_Y_TILES-1]), 0)
                if tilegrid[touch_x, touch_y] == BLANK:
                    tilegrid[touch_x, touch_y] = MONSTERQUESTION
                elif tilegrid[touch_x, touch_y] == MONSTERQUESTION:
                    tilegrid[touch_x, touch_y] = MONSTERFLAGGED
                elif tilegrid[touch_x, touch_y] == MONSTERFLAGGED:
                    under_the_tile = get_data(touch_x, touch_y)
                    if under_the_tile in MONSTERS:
                        set_data(touch_x, touch_y, MONSTERDEATH[under_the_tile-16]) #reveal a red monster
                        tilegrid[touch_x, touch_y] = MONSTERDEATH[under_the_tile-16]
                        return False          #lost
                    elif under_the_tile > OPEN0 and under_the_tile <= OPEN8:
                        tilegrid[touch_x, touch_y] = under_the_tile
                    elif under_the_tile == OPEN0:
                        tilegrid[touch_x, touch_y] = BLANK
                        number_uncovered += expand_uncovered(touch_x, touch_y)
                    else:                    #something bad happened
                        raise ValueError('Unexpected value on board')
            status = check_for_win()
            if status is None:
                continue
            return status
#pylint:enable=too-many-branches

def reset_board():
    for x in range(NB_X_TILES):
        for y in range(NB_Y_TILES):
            tilegrid[x, y] = BLANK
            set_data(x, y, 0)
    seed_monsters(NUMBER_OF_MONSTERS)
    compute_counts()

def play_sound(file_name):
    try:
        board.DISPLAY.refresh(target_frames_per_second=60)
    except AttributeError:
        board.DISPLAY.wait_for_frame()
    wavfile = open(file_name, "rb")
    wavedata = WaveFile(wavfile)
    speaker_enable.value = True
    audio.play(wavedata)
    return wavfile

def wait_for_sound_and_cleanup(wavfile):
    while audio.playing:
        pass
    wavfile.close()
    speaker_enable.value = False

def win():
    print('You won')
    wait_for_sound_and_cleanup(play_sound('sounds/win.wav'))

def lose():
    print('You lost')
    wavfile = play_sound('sounds/lose.wav')
    for _ in range(10):
        tilegrid.x = randint(-2, 2)
        tilegrid.y = randint(-2, 2)
        try:
            board.DISPLAY.refresh(target_frames_per_second=60)
        except AttributeError:
            board.DISPLAY.refresh_soon()
            board.DISPLAY.wait_for_frame()
    tilegrid.x = 0
    tilegrid.y = 0
    wait_for_sound_and_cleanup(wavfile)

# =========================================================
# Game Start
# =========================================================

while True:
    reset_board()
    if play_a_game():
        win()
    else:
        reveal()
        lose()
        # Create a json-formatted device payload
        payload = {"game_result": "FAILED"}
        # Update device shadow
        aws_iot.publish(MQTT_TOPIC, json.dumps(payload))
    # AWS IoT keep-alive
    aws_iot.loop()
    time.sleep(5.0)

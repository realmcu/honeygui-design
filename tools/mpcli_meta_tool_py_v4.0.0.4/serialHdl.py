import serial
from log import *
from err_def import *


class serial_handle(object):
    def __init__(self, config):
        self.ser = None
        self._config = config

        self.baudrate = self._config.CONFIG_SERIAL_DEFAULT_OPEN_BAUDRATE

        self.ntimeout = self._config.CONFIG_SERIAL_READ_TIMEOUT_S  # second
        self.nwrite_timeout = self._config.CONFIG_SERIAL_WRITE_TIMEOUT_S  # second
        self.ninter_byte_timeout = self._config.CONFIG_SERIAL_INTER_BYTE_TIMEOUT_S  # second
        self.serial_name = ""

    def set_read_timeout(self, timeoutSec):
        self.ser.timeout = timeoutSec

    def reset_read_timeout(self):
        self.ser.timeout = self.ntimeout

    def set_write_timeout(self, timeoutSec):
        self.ser.writeTimeout(timeoutSec)

    def set_inter_byte_timeout(self, timeoutSec):
        self.ninter_byte_timeout = timeoutSec

    def reset_inter_byte_timeout(self):
        self.ninter_byte_timeout = self._config.CONFIG_SERIAL_INTER_BYTE_TIMEOUT_S

    def get_bandrate(self):
        return self.baudrate

    def set_baudrate(self, baudrate):
        self.ser.baudrate = baudrate
        self.dump_dcb()

    @property
    def in_waiting(self):
        return self.ser.in_waiting

    def open(self, serial_name, nbaudrate=0):
        if nbaudrate == 0:
            nbaudrate = self.baudrate
        self.serial_name = serial_name
        try:
            self.ser = serial.Serial(port=serial_name,
                                     baudrate=nbaudrate,
                                     timeout=self.ntimeout,
                                     rtscts=False,
                                     write_timeout=self.nwrite_timeout,
                                     dsrdtr=False,
                                     inter_byte_timeout=self.ninter_byte_timeout)

        except ValueError as err:
            LOG_ERR(
                "Error: parameter value is invalid! serial name is %s,baudrate is %d." % (
                serial_name, nbaudrate))
            LOG_ERR(err)
            return ERR_SERIAL_OPEN_FAIL
        except serial.SerialException as err:
            LOG_ERR("Error: open %s with baudrate %d fail." % (serial_name, nbaudrate))
            LOG_ERR(err)
            return ERR_SERIAL_OPEN_FAIL
        except:
            LOG_ERR("Error: unknown exception  in open serial %s with baudrate %d." % (
            serial_name, nbaudrate))
            return ERR_SERIAL_OPEN_FAIL

        LOG_CRITICAL("Connecting %s at %d %s " % (serial_name, nbaudrate, "OK"))
        self.dump_dcb()
        return ERR_OK

    def close(self):
        if self.ser != None:
            self.ser.close()
            self.ser = None

    def read(self, size=None):
        '''
        read data from serial
        :param size:
                    if call read(), size is None, it will read all data in the serial in buffer.
                    if call read(size),Read size bytes from the serial port.
        :return bytes data read from serial.
        '''
        if size == None:
            return self.ser.readall()
        else:
            return self.ser.read(size)

    def write(self, dataBuf, dataSize,clear_trx = True):
        written_len = 0
        if self.ser != None:
            if clear_trx:
                self.clear_trx_buf()
            try:
                written_len = self.ser.write(dataBuf)
            except serial.SerialTimeoutException as err:
                LOG_ERR("Error: write data %d seconds timeout!" % self.nwrite_timeout)
                LOG_ERR(err)
                raise

            if written_len != dataSize:
                out_waiting_len = self.ser.out_waiting()
                LOG_ERR("Error: to write %d bytes, but write %d bytes,out_waiting:%d!" % (
                dataSize, written_len, out_waiting_len))
                return written_len
        else:
            LOG_ERR("Error: serial port should be opened before writing data!")
        return written_len

    def clear_trx_buf(self):
        if self.ser == None:
            LOG_ERR("Error: serial port should be opened before clearing tx/rx buffer!")
            return ERR_SERIAL_NOT_OPENED
        try:
            self.ser.reset_input_buffer()
            self.ser.reset_output_buffer()
        except serial.portNotOpenError as err:
            LOG_ERR("Error: serial port should be opened before clearing tx/rx buffer!")
            LOG_ERR(err)
            raise
        return ERR_OK

    def dump_dcb(self):
        settings = self.ser.get_settings()
        LOG_CRITICAL("serial port %s settings (timeout unit second):" % self.serial_name)

        for key, value in settings.items():
            LOG_CRITICAL("\t{0:<22}{1}".format(key + ":", value))

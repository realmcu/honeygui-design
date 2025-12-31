import os
import sys
import struct
from log import *

# global variables to keep track of number of retries
total_verify_retries = 0
total_program_retries = 0
total_erase_retries = 0
total_read_retries = 0
total_load_ram_patch_retries = 0

def add_read_retry_times(cnt):
    global total_read_retries
    total_read_retries += cnt

def add_erase_retry_times(cnt):
    global total_erase_retries
    total_erase_retries += cnt

def add_program_retry_times(cnt):
    global total_program_retries
    total_program_retries += cnt

def add_verify_retry_times(cnt):
    global total_verify_retries
    total_verify_retries += cnt

def add_load_ram_patch_retry_times(cnt):
    global total_load_ram_patch_retries
    total_load_ram_patch_retries += cnt

def dump_retry_statistic():
    global total_verify_retries
    global total_program_retries
    global total_erase_retries
    global total_read_retries
    global total_load_ram_patch_retries

    if total_program_retries > 0:
        LOG_CRITICAL('Program Retries: %d' % total_program_retries)
    if total_verify_retries > 0:
        LOG_CRITICAL('Verify Retries: %d' % total_verify_retries)
    if total_erase_retries > 0:
        LOG_CRITICAL('Erase Retries: %d' % total_erase_retries)
    if total_read_retries > 0:
        LOG_CRITICAL('Read Retries: %d' % total_read_retries)
    if total_load_ram_patch_retries > 0:
        LOG_CRITICAL('load ram patch Retries: %d' % total_load_ram_patch_retries)


def dbg_passwd_cpy(passwd):
    passwd_byte_list = []
    for val in passwd.split(":"):
        if len(val) != 0:
            passwd_byte_list.append(int(val, 16))
        else:
            passwd_byte_list.append(0)
    return passwd_byte_list


def get_little_endian_int(data_list, offset):
    int_size = struct.calcsize('<I')
    if len(data_list) < offset + int_size:
        raise Exception(
            "Error: get_littele_endian_int is used to get integer with the first 4 bytes.")
    int_val, = struct.unpack('<I', bytearray(data_list[offset:(offset + int_size)]))
    return int_val


def get_little_endian_short(data_list, offset):
    short_size = struct.calcsize('<H')
    if len(data_list) < offset + short_size:
        raise Exception(
            "Error: get_little_endian_short is used to get short with the 2 bytes.")
    short_val, = struct.unpack('<H', bytearray(data_list[offset:(offset + short_size)]))
    return short_val
def get_root_path():
    if getattr(sys, 'frozen', False):
        # 如果是打包后的可执行文件，使用sys.executable
        return os.path.dirname(sys.executable)
    else:
        # 如果是正常的脚本运行模式，使用__file__路径
        return os.path.dirname(os.path.abspath(__file__))
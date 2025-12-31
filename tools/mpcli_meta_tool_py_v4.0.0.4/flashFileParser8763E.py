import os
import json
import tempfile
import struct
from enum import IntEnum
from log import *
from mp_setting import *


class UART_ITEM_E(IntEnum):
    NAME = 0
    OPEN_BAUDRATE = 1
    MODIFY_BAUDRATE = 2


class CFG_DICT_E(IntEnum):
    SERIAL_INFO = 0
    JSON_INFO = 1


class FlashFileParser8763E(object):
    def __init__(self, config):
        self._config = config

    def IndicatorCount(self, fileIndicator):
        fileIndicator = (fileIndicator & 0x55555555) + ((fileIndicator >> 1) & 0x55555555)
        fileIndicator = (fileIndicator & 0x33333333) + ((fileIndicator >> 2) & 0x33333333)
        fileIndicator = (fileIndicator & 0x0F0F0F0F) + ((fileIndicator >> 4) & 0x0F0F0F0F)
        fileIndicator = (fileIndicator & 0x00FF00FF) + ((fileIndicator >> 8) & 0x00FF00FF)
        fileIndicator = (fileIndicator & 0x0000FFFF) + (
                    (fileIndicator >> 16) & 0x0000FFFF)
        return fileIndicator
    def reset_flash_address(self,address):
        return address

    def parseJson(self, cfg_path):
        '''
            :param cfg_path: json format configuration file path
            :return: dict{0:(port,baudrate),1:image_info_list}
                     image_info_list = [(address,img_path),]
        '''
        cfg_info_dict = {CFG_DICT_E.SERIAL_INFO: {
            UART_ITEM_E.NAME: "",
            UART_ITEM_E.MODIFY_BAUDRATE: 0
        },
            CFG_DICT_E.JSON_INFO: []
        }

        configPara = []

        if not os.path.isfile(cfg_path):
            LOG_ERR(
                "Error: %s is not an existed config file." % os.path.realpath(cfg_path))
            return cfg_info_dict

        json_path = os.path.split(os.path.realpath(cfg_path))[0]

        try:
            with open(cfg_path, 'r') as fp:
                json_data = json.load(fp)
        except FileNotFoundError:
            logging.error(f"Error: The file {cfg_path} was not found.")
        except json.JSONDecodeError:
            logging.error(f"Error: Failed to parse the JSON file {cfg_path}.")
        except Exception as e:
            logging.error(f"An unexpected error occurred: {e}")
        # except:
        #     LOG_ERR("Error: fail to load json file %s " % cfg_path)
        #     return cfg_info_dict

        if json_data.__contains__("mptoolconfig"):
            mptoolconfig_Node = json_data["mptoolconfig"]
        else:
            LOG_ERR("Error: can not find mptoolconfig node in json file %s." % cfg_path)
            return cfg_info_dict

        if mptoolconfig_Node.__contains__("port"):
            port_name = mptoolconfig_Node["port"]
        else:
            LOG_ERR("Error: can not find port node in json file %s." % cfg_path)
            return cfg_info_dict

        if mptoolconfig_Node.__contains__("baud"):
            baudrate = int(mptoolconfig_Node["baud"])
        else:
            LOG_ERR("Error: can not find baud node in json file %s." % cfg_path)
            return cfg_info_dict

        appimage_Node = None
        image_Node = None
        if mptoolconfig_Node.__contains__("appimage"):
            appimage_Node = mptoolconfig_Node["appimage"]
        elif mptoolconfig_Node.__contains__("images"):
            image_Node = mptoolconfig_Node["images"]
        else:
            LOG_ERR("Error: can not find appimage node of images node in json file %s." % cfg_path)
            return cfg_info_dict

        if appimage_Node is not None:
            if appimage_Node.__contains__("relativepath"):
                relateive_path = appimage_Node["relativepath"]

                relateive_path = os.path.join(json_path, relateive_path)
            else:
                LOG_ERR("Error: can not find relativepath node in json file %s." % cfg_path)
                return cfg_info_dict

            if appimage_Node.__contains__("file"):
                file_node = appimage_Node["file"]
                for image in file_node:
                    if image["name"] != "null" and image["address"] != "null":
                        address = int(image["address"], 16)

                        # change address to non-cache
                        address = self.reset_flash_address(address)
                        img_path = os.path.join(relateive_path, image["name"])
                        if not os.path.isfile(img_path):
                            raise Exception("Error: {} not exists,please modify json file!".format(
                                img_path))

                        configPara.append((address, img_path))
                    else:
                        continue
                if len(configPara) == 0:
                    raise Exception("Error: no image is specified in json file {}".format(img_path))
            else:
                LOG_ERR("Error: can not find file node in json file %s." % cfg_path)
                return cfg_info_dict

        if image_Node is not None:
            if image_Node.__contains__("file"):
                file_node = image_Node["file"]
                for image in file_node:
                    if image["address"] != "null" and image["path"] != "null":
                        address = int(image["address"], 16)

                        # change address to non-cache
                        address = self.reset_flash_address(address)
                        if not os.path.isfile(image["path"]):
                            raise Exception("Error: {} not exists,please modify json file!".format(
                                image["path"]))

                        configPara.append((address, image["path"]))
            else:
                LOG_ERR("Error: can not find file node in json file %s." % cfg_path)
                return cfg_info_dict

        cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
            UART_ITEM_E.MODIFY_BAUDRATE] = baudrate
        cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
            UART_ITEM_E.OPEN_BAUDRATE] = port_name
        cfg_info_dict[CFG_DICT_E.JSON_INFO] = configPara
        return cfg_info_dict

    def parsePackedFile(self, pack_path, config_para=None):
        '''

            :param pack_path: packed image file path
            :param config_para:unpacked image info. list [(img_addr,img_file_path),]
            :return:-1 fail, 0 ok.

            packed image file format:
             ____________________________________________________________________
            |Header of merged file |        Payload       |       MP Info        |
            |______________________|______________________|______________________|

            Header of merged file format:
            ___________________________________________________________________________________________________
            |  Signature     |Size of merged file|Checksum   |extension |Sub-file indicator|N*Sub-file Header  |
            |(2 bytes 0x4D47)| (4 bytes)         | (32 bytes)|(2 bytes) |  (4 bytes)       |(N*12 bytes)       |
            |________________|___________________|___________|__________|__________________|___________________|
            extension:
            bit[7:0] Header format version
            bit[15:8] ic type
            Sub-file indicator: 32 bit, every bit value 1:image exist,0:image not exist.


            Sub-file Header:
            ___________________________________________
            |Download address |Size        |Reserved   |
            |(4 bytes)        | (4 bytes)  | (4 bytes) |
            |_________________|____________|___________|

            Payload:  every image content
            '''
        PACKED_IMG_SIGNATURE = 0x4D47
        SIGNATURE_SIZE = 2
        SIZE_OF_MERGED_FILE_SIZE = 4
        CHECKSUM_SIZE = 32
        EXTENSION_SIZE = 2
        SUB_FILE_INDICATOR_OFFSET = SIGNATURE_SIZE + \
                                    SIZE_OF_MERGED_FILE_SIZE + \
                                    CHECKSUM_SIZE + \
                                    EXTENSION_SIZE
        SUB_FILE_INDICATOR_SIZE = 4
        SUB_FILE_INDICATOR_BIT_CNT = 32  # 32 bits => 4 bytes
        SUB_FILE_HEADER_OFFSET = SUB_FILE_INDICATOR_OFFSET + SUB_FILE_INDICATOR_SIZE
        PER_SUB_FILE_HEADER_SIZE = 12
        DOWNLOAD_ADDR_SIZE = 4
        DOWNLOAD_LEN_SIZE = 4

        if config_para == None:
            config_para = []

        if len(os.path.split(pack_path)[0]) == 0:
            pack_path = os.path.join(os.path.abspath("."), pack_path)
        if not os.path.exists(pack_path):
            LOG_ERR("Error: %s not exists." % pack_path)
            return -1

        destPathStr = os.path.join(tempfile.gettempdir(), "RTK_MP_CLI")
        LOG_CRITICAL("Temp dir: %s" % destPathStr)

        if not os.path.exists(destPathStr):
            os.mkdir(destPathStr)

        packed_file_size = os.path.getsize(pack_path)
        if packed_file_size < SUB_FILE_HEADER_OFFSET:
            LOG_ERR("Error: packed image length < 44 bytes.")
            return -1

        try:
            fp = open(pack_path, "rb")
        except:
            LOG_ERR("Error: open %s fail." % pack_path)
            return -1

        pre_sub_file_hdr_data = fp.read(SUB_FILE_HEADER_OFFSET)
        signature, = struct.unpack("<H", pre_sub_file_hdr_data[:2])
        if signature != PACKED_IMG_SIGNATURE:
            LOG_ERR("Error: packed image signature 0x%04X!= 0x4D47" % signature)
            fp.close()
            return -1

        subIndicator, = struct.unpack("<I", pre_sub_file_hdr_data[
                                            SUB_FILE_INDICATOR_OFFSET:SUB_FILE_INDICATOR_OFFSET + SUB_FILE_INDICATOR_SIZE])
        if subIndicator == 0:
            LOG_ERR("Error: packed subIndicator == 0.")
            fp.close()
            return -1
        else:
            img_cnt = self.IndicatorCount(subIndicator)
            packetHeaderLen = SUB_FILE_HEADER_OFFSET + PER_SUB_FILE_HEADER_SIZE * img_cnt
            sub_file_hdr_data = fp.read(PER_SUB_FILE_HEADER_SIZE * img_cnt)

        j = 0
        offset = packetHeaderLen + MP_HEADER_SIZE
        for i in range(SUB_FILE_INDICATOR_BIT_CNT):
            is_img_exist = (subIndicator >> i) & 0x01
            if is_img_exist:
                file_hdr_off = PER_SUB_FILE_HEADER_SIZE * j
                subImgAddr, = struct.unpack("<I", sub_file_hdr_data[
                                                  file_hdr_off: file_hdr_off + DOWNLOAD_ADDR_SIZE])
                subImgLen, = struct.unpack("<I", sub_file_hdr_data[
                                                 file_hdr_off + DOWNLOAD_ADDR_SIZE: file_hdr_off + DOWNLOAD_ADDR_SIZE + DOWNLOAD_LEN_SIZE])
                subImgLen -= MP_HEADER_SIZE

                binName = "0x%08x.bin" % subImgAddr
                fullBinPath = os.path.join(destPathStr, binName)
                LOG_CRITICAL("Temp file: %s" % fullBinPath)

                try:
                    bin_fp = open(fullBinPath, "wb+")
                except IOError as err:
                    fp.close()
                    LOG_ERR("Error: create file %s as wb+ mode fail." % fullBinPath)
                    LOG_ERR(err)
                    return -1

                fp.seek(offset)
                bin_fp.write(fp.read(subImgLen))
                offset += subImgLen + MP_HEADER_SIZE
                j += 1
                bin_fp.close()

                subImgAddr = self.reset_flash_address(subImgAddr)
                config_para.append((subImgAddr, fullBinPath))

        return 0

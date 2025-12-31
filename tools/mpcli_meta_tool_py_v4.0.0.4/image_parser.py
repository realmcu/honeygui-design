import os
import struct
from log import *
from mp_setting import *

IC_RTL8773EP = 0x11
class ImageParser(object):
    def __init__(self):
        self.image_file_path = ""
        self.image_dir = ""
        self.image_name = ""
        self.image_file_size = 0
        self.image_content_size = 0  # download size
        self.image_payload_len = 0  # payload_len in image control header
        self.mp_header_exist = False
        self.image_id = 0
        self.bin_id = 0
        self.bin_version = 0
        self.parser_rst = -1
        self.is_OCCD = False

        self.is_fsbl = False
        self.is_ota_hdr = False
        self.is_stack_patch = False

        self.ic_type = 0


    def reset(self):
        self.image_file_path = ""
        self.image_dir = ""
        self.image_name = ""
        self.image_file_size = 0
        self.image_content_size = 0  # download size
        self.mp_header_exist = False
        self.image_id = 0
        self.bin_id = 0
        self.bin_version = 0
        self.parser_rst = -1
        self.is_OCCD = False
        self.is_fsbl = False
        self.is_ota_hdr = False
        self.is_stack_patch = False

    @property
    def is_img_next_ota_hdr(self):
        if self.is_fsbl or self.is_stack_patch:
            return True
        else:
            return False

    @property
    def image_dl_content_size(self):
        return self.image_content_size
    @property
    def image_size(self):
        return self.image_file_size
    @property
    def is_OCCD_image(self):
        if self.image_file_path == "":
            raise Exception("Error: please call parse(image_path) firstly.")
        else:
            return self.is_OCCD

    #add fsbl and ota header special hanlder for non-sector aligned flash layout
    @property
    def is_fsbl_image(self):
        return self.is_fsbl
    @property
    def is_ota_header_image(self):
        return self.is_ota_hdr

    @property
    def is_stack_patch_image(self):
        return self.is_stack_patch

    def set_OCCD_image(self):
        self.is_OCCD = True

    def is_with_mp_hdr(self, image_path):
        if (image_path == self.image_file_path) and \
                (self.parser_rst == 0):
            return self.mp_header_exist
        elif self.parser_rst == -1:
            if self.parse(image_path) == 0:
                return self.mp_header_exist
            else:
                raise Exception("Error: parse image {} fail".format(image_path))
        else:
            raise Exception("Error: need to parse %s firstly!" % image_path)

    def parse(self, image_path):
        if self.image_file_path == image_path:
            return ERR_OK
        else:
            self.reset()

        if not os.path.isfile(image_path):
            LOG_ERR("Error: image %s not exists!" % image_path)
            return ERR_FILE_NOT_EXIST

        self.image_file_path = image_path
        self.image_file_size = os.path.getsize(image_path)
        if self.image_file_size == 0:
            LOG_ERR("Error: the file size of image file %s is 0!" % self.image_name)
            return ERR_IMG_SIZE_ZERO
        else:
            'set default image content size and image payload length'
            self.image_content_size = self.image_file_size

        if self.image_file_size <= MP_HEADER_SIZE:
            'raw data: without mp header and image header'
            self.parser_rst = 0
            return ERR_OK
        else:
            with open(image_path, 'rb') as fp:
                rd_data = fp.read(MP_HEADER_SIZE)
                if self._detect_MP_hdr(rd_data, MP_HEADER_SIZE, self.image_file_size):
                    self.mp_header_exist = True
                    if self.image_content_size == 0:
                        LOG_ERR(
                            "Error: the image %s is only with mp header, without content to download." % self.image_name)
                        return ERR_IMG_DL_CONTENT_EMPTY
                else:
                    LOG_DEBUG("%s is without MP header!" % self.image_name)
                    self.mp_header_exist = False


            self.parser_rst = 0
            return ERR_OK

    def _detect_MP_hdr(self, img_data, data_len, file_size):
        if data_len < MP_HEADER_SIZE:
            LOG_ERR(
                "Error: need more than %d bytes data to check MP header!" % MP_HEADER_SIZE)
            return False
        item_dict = {}

        parse_len = 0
        total_len = data_len
        while parse_len + 3 < data_len:
            item_id, item_len, = struct.unpack("<HB",img_data[parse_len: parse_len+3])
            if item_id != 0 and item_id != 0xFFFF and item_len < MP_HEADER_SIZE:
                item_data = img_data[parse_len+3:parse_len+3+item_len]
                item_dict[item_id] = (item_len,item_data)
                parse_len += 3 + item_len
            else:
                break
        if len(item_dict) == 0:
            return False

        exist_bit_mask = 0
        BIN_ID_BIT_MASK = 0x1
        bin_id = 0
        item_bin_id = MP_HEADER_ITEM_ID_ENUM.ITEM_BIN_ID.value

        if item_dict.__contains__(item_bin_id):
            if item_dict[item_bin_id][0] == 2:
                bin_id, = struct.unpack("<H",item_dict[item_bin_id][1])
                exist_bit_mask |= BIN_ID_BIT_MASK

        PARTNUMBER_BIT_MASK = 0x2
        item_partnumber_id = MP_HEADER_ITEM_ID_ENUM.ITEM_PART_NUMBER.value
        if item_dict.__contains__(item_partnumber_id):
            if item_dict[item_partnumber_id][0] == 0x20:
                exist_bit_mask |= PARTNUMBER_BIT_MASK

        img_size = 0
        DATA_LEN_BIT_MASK = 0x4
        item_data_len= MP_HEADER_ITEM_ID_ENUM.ITEM_DATA_LENGTH.value
        if item_dict.__contains__(item_data_len):
            if item_dict[item_data_len][0] == 0x4:
                img_size, = struct.unpack("<I",item_dict[item_data_len][1])
                exist_bit_mask |= DATA_LEN_BIT_MASK

        img_size_BIT_MASK = 0x4
        item_img_size = MP_HEADER_ITEM_ID_ENUM.ITEM_IMAGE_SIZE.value
        if item_dict.__contains__(item_img_size):
            if item_dict[item_img_size][0] == 0x4:
                img_size, = struct.unpack("<I",item_dict[item_img_size][1])
                exist_bit_mask |= img_size_BIT_MASK

        # for test with new image size uint64  item id 0x26
        img_size_new_BIT_MASK = 0x4
        item_img_size_new = 0x26
        if item_dict.__contains__(item_img_size_new):
            if item_dict[item_img_size_new][0] == 0x8:
                img_size, = struct.unpack("<Q",item_dict[item_img_size_new][1])
                exist_bit_mask |= img_size_new_BIT_MASK


        if exist_bit_mask == 0x7:
            self.bin_id = bin_id
            self.image_content_size = img_size

            if bin_id == BIN_ID_ENUM.ID_OEM_CONFIG.value:
                self.is_OCCD = True
            elif bin_id == BIN_ID_ENUM.ID_FSBL.value:
                self.is_fsbl = True
            elif bin_id == BIN_ID_ENUM.ID_OTA_HEADER.value:
                self.is_ota_hdr = True
            elif bin_id == BIN_ID_ENUM.ID_STACK_PATCH.value:
                self.is_stack_patch = True

            return True
        else:
            return False

    def parse_img_id(self, image_file, hdr_size):
        if hdr_size == 0x400:
            file_size = os.path.getsize(image_file)
            if file_size < 0x400:
                return 0
            fp = open(image_file,"rb")

            fp.seek(0x136, 0)
            img_id, = struct.unpack("<H",fp.read(2))
            if img_id == IMG_ID.SecureBoot.value:
                self.is_fsbl = True
            elif img_id == IMG_ID.OTA.value:
                self.is_ota_hdr = True
            elif img_id == IMG_ID.STACK_PATCH.value:
                self.is_stack_patch = True
            return img_id
        else:
            LOG_DEBUG("Error: only support for image with 0x400 bytes (image header)!")
            return 0



image_parser_singleton = ImageParser()

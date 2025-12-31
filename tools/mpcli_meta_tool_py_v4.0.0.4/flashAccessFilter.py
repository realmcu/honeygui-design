from log import *
from interval_type import Interval

class FlashAccessFilter(object):
    def __init__(self, config):
        # get flash black list from ini cfg
        self._config = config
        self.flash_black_space = self._config.get_flash_protection_space()

    def eval_access(self, startAddr, endAddr, ignore_log = False):
        if len(self.flash_black_space) == 0:
            return True

        accessable = True

        check_space_region = Interval(startAddr,endAddr,lower_closed=True,upper_closed=False)
        for black_space in self.flash_black_space:
            black_space_region = Interval(black_space[0],black_space[1],lower_closed=True,upper_closed=False)
            if check_space_region.overlaps(black_space_region):
                accessable = False
                if ignore_log == False:
                    LOG_CRITICAL("flash operation space [0x%08x, 0x%08x) overlaps with protection space [0x%08x, 0x%08x)" % (
                        startAddr,endAddr,black_space[0], black_space[1]))
                break
        return accessable

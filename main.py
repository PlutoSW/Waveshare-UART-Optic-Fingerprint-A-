import serial
import time
import sys

CMD_START_CODE = 0xF5
CMD_END_CODE = 0xF5
DEFAULT_BAUDRATE = 19200

DEFAULT_SERIAL_PORT = '/dev/serial0'

CMD_ADD_1 = 0x01
CMD_ADD_2 = 0x02
CMD_ADD_3 = 0x03
CMD_DELETE = 0x04
CMD_DELETE_ALL = 0x05
CMD_GET_USER_COUNT = 0x09
CMD_GET_USER_PRIV = 0x0A
CMD_COMPARE_1_1 = 0x0B
CMD_COMPARE_1_N = 0x0C
CMD_GET_DSP_VERSION = 0x26
CMD_SET_COMP_LEVEL = 0x28
CMD_SET_TIMEOUT = 0x2E

ACK_SUCCESS = 0x00
ACK_FAIL = 0x01
ACK_FULL = 0x04
ACK_NO_USER = 0x05
ACK_USER_EXIST = 0x06
ACK_FIN_EXIST = 0x07
ACK_TIMEOUT = 0x08

MAX_USERS = 4095

class FingerprintReader:
    def __init__(self, port=DEFAULT_SERIAL_PORT, baudrate=DEFAULT_BAUDRATE, timeout=10):
        try:
            self.serial = serial.Serial(port, baudrate, timeout=timeout)
            print(f"'{port}' serial port is opened.")
        except serial.SerialException as e:
            print(f"Error: '{port}' serial port could not be opened. {e}")
            print("Please check the port and try again.")
            sys.exit(1)
        self.last_response = None

    def _calculate_checksum(self, packet_data):
        checksum = 0
        for byte in packet_data:
            checksum ^= byte
        return checksum

    def _build_command(self, cmd, p1=0, p2=0, p3=0):
        params = [cmd, p1, p2, p3, 0]
        checksum = self._calculate_checksum(params)
        packet = bytes([CMD_START_CODE] + params + [checksum, CMD_END_CODE])
        return packet

    def send_command(self, cmd, p1=0, p2=0, p3=0):
        command_packet = self._build_command(cmd, p1, p2, p3)
        self.serial.write(command_packet)
        response = self.serial.read(8)
        self.last_response = response
        return response

    def _parse_response(self):
        if not self.last_response or len(self.last_response) != 8:
            return ACK_FAIL, f"Time out! Pleas try again."

        if self.last_response[0] != CMD_START_CODE or self.last_response[7] != CMD_END_CODE:
            return ACK_FAIL, "Invalid response format."

        params = self.last_response[1:6]
        received_checksum = self.last_response[6]
        calculated_checksum = self._calculate_checksum(params)
        if received_checksum != calculated_checksum:
            return ACK_FAIL, f"Checksum mismatch (Received: {received_checksum}, Expected: {calculated_checksum})"

        status = self.last_response[4]
        return status, self.get_ack_message(status)

    @staticmethod
    def get_ack_message(status_code):
        return {
            ACK_SUCCESS: "✅ Success",
            ACK_FAIL: "❌ Failed",
            ACK_FULL: "⚠️ Memory full",
            ACK_NO_USER: "❌ The person could not be found",
            ACK_USER_EXIST: "⚠️ The person already exists",
            ACK_FIN_EXIST: "⚠️ Fingerprint already exists",
            ACK_TIMEOUT: "⌛ Timeout. Data could not be retrieved from the sensor."
        }.get(status_code, f"❓ Unknown status (0x{status_code:02X})")

    def get_user_count(self):
        print("\n User count is being retrieved...")
        self.send_command(CMD_GET_USER_COUNT)
        status, message = self._parse_response()
        if status == ACK_SUCCESS:
            count = (self.last_response[2] << 8) + self.last_response[3]
            print(f"👥 User count: {count}")
            return count
        else:
            print(message)
            return -1

    def enroll_fingerprint(self, user_id, permission=1, callback=None):
        def report_status(step, state, message):
            if callback:
                callback(step, state, message)
            else:
                
                print(f"Step {step} [{state}]: {message}")

        if not (1 <= user_id <= MAX_USERS):
            msg = f"Invalid User ID: {user_id}. The ID must be between 1 and {MAX_USERS}."
            report_status(1, 'error', msg)
            return False
        if not (1 <= permission <= 3):
            msg = f"Invalid Permission Level: {permission}. The permission level must be between 1 and 3."
            report_status(1, 'error', msg)
            return False

        uid_h, uid_l = (user_id >> 8) & 0xFF, user_id & 0xFF
        steps = [
            (1, CMD_ADD_1, "Please place your finger on the sensor."),
            (2, CMD_ADD_2, "Please place the same finger on the sensor again."),
            (3, CMD_ADD_3, "Place the same finger on the sensor one last time.")
        ]

        for step, cmd, prompt_message in steps:
            report_status(step, 'progress', prompt_message)

            self.send_command(cmd, uid_h, uid_l, permission)
            status, response_message = self._parse_response()
            
            if status != ACK_SUCCESS:
                error_msg = f"{response_message}. Please try again."
                report_status(step, 'error', error_msg)
                return False

            if step < 3:
                report_status(step, 'success', "Raise your finger.")
                time.sleep(2)

        report_status(3, 'success', "Registration was successful!")
        return True

    def verify_1_to_n(self):
        self.send_command(CMD_COMPARE_1_N)
        if not self.last_response or len(self.last_response) != 8:
            print(f"Timeout! Please try again.")
            return -1
        status_byte = self.last_response[4]
        if status_byte == ACK_NO_USER:
            print("No match found.")
            return -1
        
        if self.last_response[0] == CMD_START_CODE and self.last_response[7] == CMD_END_CODE:
            user_id = (self.last_response[2] << 8) + self.last_response[3]
            permission = self.last_response[4]
            return user_id
        else:
            print(self.get_ack_message(status_byte))
            return -1

    def delete_user(self, user_id):
        if not (1 <= user_id <= MAX_USERS):
            msg = f"Invalid User ID: {user_id}."
            return False, msg

        uid_h, uid_l = (user_id >> 8) & 0xFF, user_id & 0xFF
        self.send_command(CMD_DELETE, uid_h, uid_l)
        status, message = self._parse_response()
        success = (status == ACK_SUCCESS or status == ACK_NO_USER)
        return success, message

    def delete_all_users(self):
        print("All users are being deleted...")
        self.send_command(CMD_DELETE_ALL)
        status, message = self._parse_response()
        print(message)
        return status == ACK_SUCCESS

    def close(self):
        if self.serial and self.serial.is_open:
            self.serial.close()
            print("\nThe serial port has been closed.")

if __name__ == '__main__':
    reader = FingerprintReader(port=DEFAULT_SERIAL_PORT)
    try:  
        user_count = reader.get_user_count()
 
        print("\n--- Library Usage Example: Authentication ---")
        identified_user = reader.verify_1_to_n()
        if identified_user != -1:
            print(f"Success: Welcome, user {identified_user}!")

    except KeyboardInterrupt:
        print("\nScanning is complete.")
    finally:    
        reader.close()

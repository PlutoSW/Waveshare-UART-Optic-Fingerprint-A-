const { SerialPort } = require("serialport");

const CMD_START_CODE = 0xf5;
const CMD_END_CODE = 0xf5;
const DEFAULT_BAUDRATE = 19200;
const DEFAULT_SERIAL_PORT = "/dev/serial0";

const CMD_ADD_1 = 0x01;
const CMD_ADD_2 = 0x02;
const CMD_ADD_3 = 0x03;
const CMD_DELETE = 0x04;
const CMD_DELETE_ALL = 0x05;
const CMD_GET_USER_COUNT = 0x09;
const CMD_GET_USER_PRIV = 0x0a;
const CMD_COMPARE_1_N = 0x0c;
const CMD_SET_COMP_LEVEL = 0x28;
const CMD_GET_CHAR = 0x31;

const ACK_SUCCESS = 0x00;
const ACK_FAIL = 0x01;
const ACK_FULL = 0x04;
const ACK_NO_USER = 0x05;
const ACK_USER_EXIST = 0x06;
const ACK_FIN_EXIST = 0x07;
const ACK_TIMEOUT = 0x08;

const MAX_USERS = 4095;

class FingerprintReader {
	constructor(port = DEFAULT_SERIAL_PORT, baudrate = DEFAULT_BAUDRATE, timeout = 5) {
		this.port = new SerialPort({ path: port, baudRate: baudrate, autoOpen: false });
		this.timeout = timeout * 1000;
		this.lastResponse = null;
		this.buffer = Buffer.alloc(0);

		this.port.on("data", (data) => {
			this.buffer = Buffer.concat([this.buffer, data]);
		});
		if (!this.port.isOpen) {
			this.port.open((err) => {
				if (err) {
					console.error(err);
					process.exit(1);
				}
			});
		}
	}

	async setSecurityLevel(level) {
		if (level < 1 || level > 9) {
			return [false, "Hassasiyet seviyesi 1-9 arasında olmalıdır."];
		}

		await this.sendCommand(CMD_SET_COMP_LEVEL, 0, 0, level);
		const [status, message] = this._parseResponse();

		return [status === ACK_SUCCESS, message];
	}

	async getSecurityLevel() {
		await this.sendCommand(0x29);
		const [status] = this._parseResponse();

		if (status === ACK_SUCCESS) {
			return this.lastResponse[4];
		}
		return -1;
	}

	_calculateChecksum(packetData) {
		let checksum = 0;
		for (let byte of packetData) {
			checksum ^= byte;
		}
		return checksum;
	}

	_buildCommand(cmd, p1 = 0, p2 = 0, p3 = 0) {
		const params = [cmd, p1, p2, p3, 0];
		const checksum = this._calculateChecksum(params);
		return Buffer.from([CMD_START_CODE, ...params, checksum, CMD_END_CODE]);
	}

	formatEigenvalueToHex(eigenvalueBytes) {
		if (!eigenvalueBytes || eigenvalueBytes.length === 0) {
			return "Veri yok.";
		}

		let formattedOutput = "";

		for (let i = 0; i < eigenvalueBytes.length; i += 16) {
			const chunk = eigenvalueBytes.subarray(i, i + 16);
			const hexChunk = Array.from(chunk)
				.map((b) => b.toString(16).padStart(2, "0").toUpperCase())
				.join(" ");
			formattedOutput += `${i.toString(16).padStart(3, "0").toUpperCase()}  | ${hexChunk}\n`;
		}
		return formattedOutput;
	}

	async _readBytes(length) {
		return new Promise((resolve) => {
			const start = Date.now();
			const check = () => {
				if (this.buffer.length >= length) {
					const data = Buffer.from(this.buffer.subarray(0, length));
					this.buffer = Buffer.from(this.buffer.subarray(length));
					resolve(data);
				} else if (Date.now() - start > this.timeout) {
					const data = Buffer.from(this.buffer);
					this.buffer = Buffer.alloc(0);
					resolve(data);
				} else {
					setImmediate(check);
				}
			};
			check();
		});
	}

	async getFingerprintCharacteristic(userId) {
		if (userId < 1 || userId > MAX_USERS) {
			return null;
		}

		this.buffer = Buffer.alloc(0); // reset input buffer
		const uid_h = (userId >> 8) & 0xff;
		const uid_l = userId & 0xff;

		await this.sendCommand(CMD_GET_CHAR, uid_h, uid_l);
		const [status] = this._parseResponse();

		if (status === ACK_SUCCESS) {
			const rawPacket = await this._readBytes(199);

			if (rawPacket.length === 199 && rawPacket[0] === 0xf5 && rawPacket[198] === 0xf5) {
				const eigenvalue = rawPacket.subarray(4, 197);
				console.log(this.formatEigenvalueToHex(eigenvalue));
			}
		}
		return null;
	}

	async sendCommand(cmd, p1 = 0, p2 = 0, p3 = 0) {
		this.buffer = Buffer.alloc(0); // reset input buffer
		const commandPacket = this._buildCommand(cmd, p1, p2, p3);

		await new Promise((resolve) => {
			this.port.write(commandPacket, resolve);
		});

		const response = await this._readBytes(8);
		this.lastResponse = response;
		return response;
	}

	_parseResponse() {
		if (!this.lastResponse || this.lastResponse.length !== 8) {
			return [ACK_FAIL, "Zaman aşımı! Lütfen tekrar deneyin."];
		}
		if (this.lastResponse[0] !== CMD_START_CODE || this.lastResponse[7] !== CMD_END_CODE) {
			return [ACK_FAIL, "Hatalı yanıt paketi"];
		}

		const params = this.lastResponse.subarray(1, 6);
		const receivedChecksum = this.lastResponse[6];
		const calculatedChecksum = this._calculateChecksum(params);

		if (receivedChecksum !== calculatedChecksum) {
			return [
				ACK_FAIL,
				`Checksum uyuşmazlığı (Alınan: ${receivedChecksum}, Beklenen: ${calculatedChecksum})`,
			];
		}

		const status = this.lastResponse[4];
		return [status, FingerprintReader.getAckMessage(status)];
	}

	static getAckMessage(statusCode) {
		const messages = {
			[ACK_SUCCESS]: "✅ Başarılı",
			[ACK_FAIL]: "❌ Hatalı",
			[ACK_FULL]: "⚠️ Hafıza dolu",
			[ACK_NO_USER]: "❌ Personel bulunamadı",
			[ACK_USER_EXIST]: "⚠️ Personel zaten tanımlı",
			[ACK_FIN_EXIST]: "⚠️ Parmak izi zaten mevcut",
			[ACK_TIMEOUT]: "⌛ Zaman aşımı. Sensörden veri alınamadı.",
		};
		return (
			messages[statusCode] ||
			`❓ Bilinmeyen hata (0x${statusCode.toString(16).padStart(2, "0").toUpperCase()})`
		);
	}

	async getEnrolledUsers() {
		const totalUsers = await this.getUserCount();
		if (totalUsers <= 0) {
			return [];
		}

		const enrolledUsers = [];

		for (let userId = 1; userId <= MAX_USERS; userId++) {
			const uid_h = (userId >> 8) & 0xff;
			const uid_l = userId & 0xff;

			await this.sendCommand(CMD_GET_USER_PRIV, uid_h, uid_l);
			const [status] = this._parseResponse();

			if (status === ACK_SUCCESS) {
				enrolledUsers.push(userId);

				if (enrolledUsers.length === totalUsers) {
					break;
				}
			}
		}
		return enrolledUsers;
	}

	async getUserCount() {
		await this.sendCommand(CMD_GET_USER_COUNT);
		const [status, message] = this._parseResponse();

		if (status === ACK_SUCCESS) {
			const count = (this.lastResponse[2] << 8) + this.lastResponse[3];
			return count;
		} else {
			console.log(message);
			return -1;
		}
	}

	async _enrollStepBase(cmd, userId, permission) {
		if (userId < 1 || userId > MAX_USERS) {
			return [false, `Geçersiz ID: ${userId}. Sınır: 1-${MAX_USERS}`];
		}
		if (permission < 1 || permission > 3) {
			return [false, `Geçersiz Yetki: ${permission}. Sınır: 1-3`];
		}

		const uid_h = (userId >> 8) & 0xff;
		const uid_l = userId & 0xff;

		await this.sendCommand(cmd, uid_h, uid_l, permission);
		const [status, message] = this._parseResponse();
		return {
			success: status === ACK_SUCCESS,
			message,
		};
	}

	async enrollStep1(userId, permission = 1) {
		await this.setSecurityLevel(3);
		return await this._enrollStepBase(CMD_ADD_1, userId, permission);
	}

	async enrollStep2(userId, permission = 1) {
		return await this._enrollStepBase(CMD_ADD_2, userId, permission);
	}

	async enrollStep3(userId, permission = 1) {
		return await this._enrollStepBase(CMD_ADD_3, userId, permission);
	}

	async verify1ToN() {
		await this.setSecurityLevel(3);
		await this.sendCommand(CMD_COMPARE_1_N);

		if (!this.lastResponse || this.lastResponse.length !== 8) {
			return -1;
		}

		const statusByte = this.lastResponse[4];

		if (statusByte === ACK_NO_USER) {
			return -1;
		}

		if (this.lastResponse[0] === CMD_START_CODE && this.lastResponse[7] === CMD_END_CODE) {
			const userId = (this.lastResponse[2] << 8) + this.lastResponse[3];
			return userId;
		} else {
			return -1;
		}
	}

	async deleteUser(userId) {
		if (userId < 1 || userId > MAX_USERS) {
			const msg = `Geçersiz Kullanıcı ID'si: ${userId}.`;
			return [false, msg];
		}

		const uid_h = (userId >> 8) & 0xff;
		const uid_l = userId & 0xff;

		await this.sendCommand(CMD_DELETE, uid_h, uid_l);
		const [status, message] = this._parseResponse();

		const success = status === ACK_SUCCESS || status === ACK_NO_USER;
		return {
			success,
			message,
		};
	}

	async deleteAllUsers(confirmInput) {
		if (confirmInput.toLowerCase() !== "evet") {
			console.log("İşlem iptal edildi.");
			return false;
		}
		await this.sendCommand(CMD_DELETE_ALL);
		const [status, message] = this._parseResponse();
		return status === ACK_SUCCESS;
	}

	async close() {
		if (this.port.isOpen) {
			return new Promise((resolve) => this.port.close(resolve));
		}
	}
}

export default FingerprintReader;

import assert from "node:assert/strict";
import test from "node:test";

import {
    parseAdbDevices,
    selectPhysicalDevice
} from "../scripts/android-physical-device-uat.mjs";

test("parseAdbDevices reads attached Android device rows", () => {
    const devices = parseAdbDevices(`List of devices attached
R58M12345AB	device usb:1-1 product:dm3q model:SM_S918U device:dm3q transport_id:1
emulator-5580	device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:2
offline123	offline
`);

    assert.deepEqual(devices, [
        {
            serial: "R58M12345AB",
            state: "device",
            details: "usb:1-1 product:dm3q model:SM_S918U device:dm3q transport_id:1"
        },
        {
            serial: "emulator-5580",
            state: "device",
            details: "product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:emu64xa transport_id:2"
        },
        {
            serial: "offline123",
            state: "offline",
            details: ""
        }
    ]);
});

test("selectPhysicalDevice rejects emulator-only runs", () => {
    assert.throws(
        () => selectPhysicalDevice([
            {serial: "emulator-5580", state: "device", isEmulator: true}
        ]),
        /No physical Android device attached/
    );
});

test("selectPhysicalDevice requires an explicit serial for multiple physical devices", () => {
    assert.throws(
        () => selectPhysicalDevice([
            {serial: "R58M12345AB", state: "device", isEmulator: false},
            {serial: "R58M67890CD", state: "device", isEmulator: false}
        ]),
        /Multiple physical Android devices/
    );
});

test("selectPhysicalDevice honors requested physical serial", () => {
    const selected = selectPhysicalDevice([
        {serial: "emulator-5580", state: "device", isEmulator: true},
        {serial: "R58M12345AB", state: "device", isEmulator: false}
    ], "R58M12345AB");

    assert.equal(selected.serial, "R58M12345AB");
});

test("selectPhysicalDevice rejects requested emulator serial", () => {
    assert.throws(
        () => selectPhysicalDevice([
            {serial: "emulator-5580", state: "device", isEmulator: true}
        ], "emulator-5580"),
        /is an emulator/
    );
});

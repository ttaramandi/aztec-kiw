// See `schnorr_verify_circuit` integration test in `acir/tests/test_program_serialization.rs`.
export const bytecode = Uint8Array.from([
  31, 139, 8, 0, 0, 0, 0, 0, 0, 255, 77, 210, 87, 78, 2, 1, 20, 134, 209, 177, 247, 222, 123, 71, 68, 68, 68, 68, 68,
  68, 68, 68, 68, 221, 133, 251, 95, 130, 145, 27, 206, 36, 78, 50, 57, 16, 94, 200, 253, 191, 159, 36, 73, 134, 146,
  193, 19, 142, 243, 183, 255, 14, 179, 233, 247, 145, 254, 59, 217, 127, 71, 57, 198, 113, 78, 48, 125, 167, 56, 205,
  25, 206, 114, 142, 243, 92, 224, 34, 151, 184, 204, 21, 174, 114, 141, 235, 220, 224, 38, 183, 184, 205, 29, 238, 114,
  143, 251, 60, 224, 33, 143, 120, 204, 19, 158, 242, 140, 25, 158, 51, 203, 11, 230, 120, 201, 60, 175, 88, 224, 53,
  139, 188, 97, 137, 183, 44, 243, 142, 21, 222, 179, 202, 7, 214, 248, 200, 58, 159, 216, 224, 51, 155, 124, 97, 235,
  223, 142, 241, 188, 250, 222, 230, 27, 59, 124, 103, 151, 31, 236, 241, 147, 95, 252, 246, 57, 158, 104, 47, 186, 139,
  214, 162, 179, 104, 44, 250, 74, 219, 154, 242, 63, 162, 165, 232, 40, 26, 138, 126, 162, 157, 232, 38, 154, 137, 94,
  162, 149, 232, 36, 26, 137, 62, 162, 141, 232, 34, 154, 136, 30, 162, 133, 232, 32, 26, 136, 253, 99, 251, 195, 100,
  176, 121, 236, 29, 91, 159, 218, 56, 99, 219, 172, 77, 115, 182, 204, 219, 176, 96, 187, 162, 205, 74, 182, 42, 219,
  168, 98, 155, 170, 77, 106, 182, 168, 219, 160, 225, 246, 77, 55, 111, 185, 113, 219, 109, 59, 110, 218, 117, 203,
  158, 27, 166, 55, 75, 239, 150, 184, 101, 250, 252, 1, 55, 204, 92, 74, 220, 3, 0, 0,
]);

export const initialWitnessMap = new Map([
  [1, '0x04b260954662e97f00cab9adb773a259097f7a274b83b113532bce27fa3fb96a'],
  [2, '0x2fd51571db6c08666b0edfbfbc57d432068bccd0110a39b166ab243da0037197'],
  [3, '0x000000000000000000000000000000000000000000000000000000000000002e'],
  [4, '0x00000000000000000000000000000000000000000000000000000000000000ce'],
  [5, '0x0000000000000000000000000000000000000000000000000000000000000052'],
  [6, '0x00000000000000000000000000000000000000000000000000000000000000aa'],
  [7, '0x0000000000000000000000000000000000000000000000000000000000000087'],
  [8, '0x000000000000000000000000000000000000000000000000000000000000002a'],
  [9, '0x0000000000000000000000000000000000000000000000000000000000000049'],
  [10, '0x000000000000000000000000000000000000000000000000000000000000009d'],
  [11, '0x0000000000000000000000000000000000000000000000000000000000000050'],
  [12, '0x000000000000000000000000000000000000000000000000000000000000007c'],
  [13, '0x000000000000000000000000000000000000000000000000000000000000009a'],
  [14, '0x00000000000000000000000000000000000000000000000000000000000000aa'],
  [15, '0x00000000000000000000000000000000000000000000000000000000000000df'],
  [16, '0x0000000000000000000000000000000000000000000000000000000000000023'],
  [17, '0x0000000000000000000000000000000000000000000000000000000000000034'],
  [18, '0x0000000000000000000000000000000000000000000000000000000000000010'],
  [19, '0x000000000000000000000000000000000000000000000000000000000000008a'],
  [20, '0x0000000000000000000000000000000000000000000000000000000000000047'],
  [21, '0x0000000000000000000000000000000000000000000000000000000000000063'],
  [22, '0x00000000000000000000000000000000000000000000000000000000000000e8'],
  [23, '0x0000000000000000000000000000000000000000000000000000000000000037'],
  [24, '0x0000000000000000000000000000000000000000000000000000000000000054'],
  [25, '0x0000000000000000000000000000000000000000000000000000000000000096'],
  [26, '0x000000000000000000000000000000000000000000000000000000000000003e'],
  [27, '0x00000000000000000000000000000000000000000000000000000000000000d5'],
  [28, '0x00000000000000000000000000000000000000000000000000000000000000ae'],
  [29, '0x0000000000000000000000000000000000000000000000000000000000000024'],
  [30, '0x000000000000000000000000000000000000000000000000000000000000002d'],
  [31, '0x0000000000000000000000000000000000000000000000000000000000000020'],
  [32, '0x0000000000000000000000000000000000000000000000000000000000000080'],
  [33, '0x000000000000000000000000000000000000000000000000000000000000004d'],
  [34, '0x0000000000000000000000000000000000000000000000000000000000000047'],
  [35, '0x00000000000000000000000000000000000000000000000000000000000000a5'],
  [36, '0x00000000000000000000000000000000000000000000000000000000000000bb'],
  [37, '0x00000000000000000000000000000000000000000000000000000000000000f6'],
  [38, '0x00000000000000000000000000000000000000000000000000000000000000c3'],
  [39, '0x000000000000000000000000000000000000000000000000000000000000000b'],
  [40, '0x000000000000000000000000000000000000000000000000000000000000003b'],
  [41, '0x0000000000000000000000000000000000000000000000000000000000000065'],
  [42, '0x00000000000000000000000000000000000000000000000000000000000000c9'],
  [43, '0x0000000000000000000000000000000000000000000000000000000000000001'],
  [44, '0x0000000000000000000000000000000000000000000000000000000000000085'],
  [45, '0x0000000000000000000000000000000000000000000000000000000000000006'],
  [46, '0x000000000000000000000000000000000000000000000000000000000000009e'],
  [47, '0x000000000000000000000000000000000000000000000000000000000000002f'],
  [48, '0x0000000000000000000000000000000000000000000000000000000000000010'],
  [49, '0x00000000000000000000000000000000000000000000000000000000000000e6'],
  [50, '0x0000000000000000000000000000000000000000000000000000000000000030'],
  [51, '0x000000000000000000000000000000000000000000000000000000000000004a'],
  [52, '0x0000000000000000000000000000000000000000000000000000000000000018'],
  [53, '0x000000000000000000000000000000000000000000000000000000000000007c'],
  [54, '0x00000000000000000000000000000000000000000000000000000000000000d0'],
  [55, '0x00000000000000000000000000000000000000000000000000000000000000ab'],
  [56, '0x0000000000000000000000000000000000000000000000000000000000000031'],
  [57, '0x00000000000000000000000000000000000000000000000000000000000000d5'],
  [58, '0x0000000000000000000000000000000000000000000000000000000000000063'],
  [59, '0x0000000000000000000000000000000000000000000000000000000000000084'],
  [60, '0x00000000000000000000000000000000000000000000000000000000000000a3'],
  [61, '0x00000000000000000000000000000000000000000000000000000000000000a6'],
  [62, '0x00000000000000000000000000000000000000000000000000000000000000d5'],
  [63, '0x0000000000000000000000000000000000000000000000000000000000000091'],
  [64, '0x000000000000000000000000000000000000000000000000000000000000000d'],
  [65, '0x000000000000000000000000000000000000000000000000000000000000009c'],
  [66, '0x00000000000000000000000000000000000000000000000000000000000000f9'],
  [67, '0x0000000000000000000000000000000000000000000000000000000000000000'],
  [68, '0x0000000000000000000000000000000000000000000000000000000000000001'],
  [69, '0x0000000000000000000000000000000000000000000000000000000000000002'],
  [70, '0x0000000000000000000000000000000000000000000000000000000000000003'],
  [71, '0x0000000000000000000000000000000000000000000000000000000000000004'],
  [72, '0x0000000000000000000000000000000000000000000000000000000000000005'],
  [73, '0x0000000000000000000000000000000000000000000000000000000000000006'],
  [74, '0x0000000000000000000000000000000000000000000000000000000000000007'],
  [75, '0x0000000000000000000000000000000000000000000000000000000000000008'],
  [76, '0x0000000000000000000000000000000000000000000000000000000000000009'],
]);

export const expectedWitnessMap = new Map(initialWitnessMap).set(
  77,
  '0x0000000000000000000000000000000000000000000000000000000000000001',
);

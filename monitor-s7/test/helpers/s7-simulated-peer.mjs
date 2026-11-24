// Local protocol peer for tests only. It implements the small read/write subset
// exercised by the Monitor, not PLC scan/firmware/PLCSIM semantics.
import { createServer } from 'node:net';
import { once } from 'node:events';
import nodes7 from '@st-one-io/nodes7';
import isoTcp from 'iso-on-tcp';
export async function simulatedPeer() {
  const { S7Parser, S7Serializer, s7constants: c } = nodes7;
  const sockets = new Set(), writes = [], errors = [], memory = new Map();
  const state = { rejectWrites: false, revertInputs: false };
  const bytes = (area, db = 0) => {
    const key = `${area}:${db}`; if (!memory.has(key)) memory.set(key, Buffer.alloc(4096)); return memory.get(key);
  };
  bytes(c.proto.area.INPUTS)[34] = 0x02;
  const server = createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    const iso = new isoTcp.ISOOnTCPClient(socket, { handleStreamEvents: true });
    const parser = new S7Parser(), serializer = new S7Serializer();
    for (const stream of [iso, parser, serializer]) stream.on('error', e => { errors.push(e.message); socket.destroy(); });
    iso.pipe(parser); serializer.pipe(iso);
    parser.on('data', request => {
      const fn = request.param.function;
      const reply = { header: { type: c.proto.type.RESPONSE, pduReference: request.header.pduReference }, param: { function: fn } };
      if (fn === c.proto.function.COMM_SETUP) Object.assign(reply.param, { maxJobsCalling: 1, maxJobsCalled: 1, pduLength: request.param.pduLength });
      else if (fn === c.proto.function.READ_VAR) {
        reply.param.itemCount = request.param.items.length;
        reply.data = { items: request.param.items.map(item => {
          const buffer = bytes(item.area, item.db), offset = Math.floor(item.address / 8);
          const data = item.transport === c.proto.transport.BIT ? Buffer.from([(buffer[offset] >> (item.address % 8)) & 1]) : Buffer.from(buffer.subarray(offset, offset + item.length));
          return { returnCode: 255, transportSize: item.transport === c.proto.transport.BIT ? c.proto.dataTransport.BBIT : c.proto.dataTransport.BBYTE, data };
        }) };
      } else if (fn === c.proto.function.WRITE_VAR) {
        reply.param.itemCount = request.param.items.length;
        reply.data = { items: request.param.items.map((item, i) => {
          const data = request.data.items[i].data;
          writes.push({ ...item, data: [...data] });
          if (state.rejectWrites) return { returnCode: 5 };
          const buffer = bytes(item.area, item.db), offset = Math.floor(item.address / 8);
          if (item.transport === c.proto.transport.BIT) {
            const mask = 1 << (item.address % 8);
            buffer[offset] = (buffer[offset] & ~mask) | (data[0] ? mask : 0);
            if (state.revertInputs && item.area === c.proto.area.INPUTS) buffer[offset] &= ~mask;
          } else data.copy(buffer, offset);
          return { returnCode: 255 };
        }) };
      } else { errors.push('Função não emulada: ' + fn); socket.destroy(); return; }
      serializer.write(reply);
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { port: server.address().port, state, writes, errors, bytes, constants: c, async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}

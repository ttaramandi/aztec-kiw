import { GrumpkinPrivateKey, PublicKey } from '@aztec/circuits.js';
import { Grumpkin } from '@aztec/circuits.js/barretenberg';
import { Fr } from '@aztec/foundation/fields';
import { BufferReader, serializeToBuffer } from '@aztec/foundation/serialize';

import { L1NotePayload } from './l1_note_payload.js';

// placeholder value until tagging is implemented
const PLACEHOLDER_TAG = new Fr(33);

/**
 * Encrypted note payload with a tag used for retrieval by clients.
 */
export class TaggedNote {
  constructor(public notePayload: L1NotePayload, public tag = PLACEHOLDER_TAG) {}

  /**
   * Deserializes the TaggedNote object from a Buffer.
   * @param buffer - Buffer or BufferReader object to deserialize.
   * @returns An instance of TaggedNote.
   */
  static fromBuffer(buffer: Buffer | BufferReader): TaggedNote {
    const reader = BufferReader.asReader(buffer);
    return new TaggedNote(L1NotePayload.fromBuffer(reader), Fr.fromBuffer(reader));
  }

  /**
   * Serializes the TaggedNote object into a Buffer.
   * @returns Buffer representation of the TaggedNote object (unencrypted).
   */
  public toBuffer(): Buffer {
    return serializeToBuffer([this.tag, this.notePayload]);
  }

  /**
   * Encrypt the L1NotePayload object using the owner's public key and the ephemeral private key.
   * @param ownerPubKey - Public key of the owner of the L1NotePayload object.
   * @param curve - The curve instance to use.
   * @returns The encrypted L1NotePayload object.
   */
  public toEncryptedBuffer(ownerPubKey: PublicKey, curve: Grumpkin): Buffer {
    const encryptedL1NotePayload = this.notePayload.toEncryptedBuffer(ownerPubKey, curve);
    return serializeToBuffer([this.tag, encryptedL1NotePayload]);
  }

  /**
   * Decrypts the L1NotePayload object using the owner's private key.
   * @param data - Encrypted L1NotePayload object.
   * @param ownerPrivKey - Private key of the owner of the L1NotePayload object.
   * @param curve - The curve instance to use.
   * @returns Instance of L1NotePayload if the decryption was successful, undefined otherwise.
   */
  static fromEncryptedBuffer(data: Buffer, ownerPrivKey: GrumpkinPrivateKey, curve: Grumpkin): TaggedNote | undefined {
    const reader = BufferReader.asReader(data);
    const tag = Fr.fromBuffer(reader);
    const encryptedL1NotePayload = reader.readBuffer();
    const decryptedL1NotePayload = L1NotePayload.fromEncryptedBuffer(encryptedL1NotePayload, ownerPrivKey, curve);
    if (!decryptedL1NotePayload) {
      return;
    }
    return new TaggedNote(decryptedL1NotePayload, tag);
  }
}

//! Electron `safeStorage` blobs on macOS (`v10`): AES-128-CBC with a 16-space IV
//! and a key derived by PBKDF2-HMAC-SHA1 (salt `saltysalt`, 1003 rounds) from the
//! app's Keychain "Safe Storage" password. Cursor 3.27+ stores its editor login
//! in `state.vscdb` as `cursor-safe-storage:v1:` + base64 of such a blob.

use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};

type Aes128CbcEnc = cbc::Encryptor<aes::Aes128>;
type Aes128CbcDec = cbc::Decryptor<aes::Aes128>;

const VERSION_PREFIX: &[u8] = b"v10";
const SALT: &[u8] = b"saltysalt";
const ROUNDS: u32 = 1003;
const IV: [u8; 16] = [b' '; 16];

fn derive_key(password: &str) -> [u8; 16] {
    let mut key = [0u8; 16];
    pbkdf2::pbkdf2_hmac::<sha1::Sha1>(password.as_bytes(), SALT, ROUNDS, &mut key);
    key
}

/// Opens base64 of a `v10` blob. Errors never include the plaintext or the password.
pub(crate) fn open(blob_b64: &str, password: &str) -> Result<String, String> {
    let blob = BASE64_STANDARD
        .decode(blob_b64.trim())
        .map_err(|_| "safe storage blob is not base64".to_string())?;
    if blob.len() <= VERSION_PREFIX.len() || !blob.starts_with(VERSION_PREFIX) {
        return Err("safe storage blob is not v10".to_string());
    }
    let mut buf = blob[VERSION_PREFIX.len()..].to_vec();
    let key = derive_key(password);
    let plain = Aes128CbcDec::new(&key.into(), &IV.into())
        .decrypt_padded_mut::<Pkcs7>(&mut buf)
        .map_err(|_| "safe storage key does not open this blob".to_string())?;
    String::from_utf8(plain.to_vec()).map_err(|_| "safe storage plaintext is not UTF-8".to_string())
}

/// Seals plaintext into base64 of a `v10` blob that Electron can open.
pub(crate) fn seal(plaintext: &str, password: &str) -> String {
    let key = derive_key(password);
    let len = plaintext.len();
    let mut buf = vec![0u8; len + 16];
    buf[..len].copy_from_slice(plaintext.as_bytes());
    let cipher = Aes128CbcEnc::new(&key.into(), &IV.into())
        .encrypt_padded_mut::<Pkcs7>(&mut buf, len)
        .expect("buffer has room for one padding block");
    let mut out = VERSION_PREFIX.to_vec();
    out.extend_from_slice(cipher);
    BASE64_STANDARD.encode(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips() {
        let sealed = seal("header.payload.sig", "pw");
        assert_eq!(open(&sealed, "pw").unwrap(), "header.payload.sig");
    }

    #[test]
    fn matches_openssl_vector() {
        // PBKDF2-SHA1("peanuts", "saltysalt", 1003) key, 16-space IV, `openssl enc -aes-128-cbc`.
        assert_eq!(seal("hello", "peanuts"), "djEwhpCnyzx4cdGhYCRGnONbQw==");
        assert_eq!(open("djEwhpCnyzx4cdGhYCRGnONbQw==", "peanuts").unwrap(), "hello");
    }

    #[test]
    fn rejects_bad_input() {
        assert!(open("%%%", "pw").unwrap_err().contains("base64"));
        assert!(open(&BASE64_STANDARD.encode(b"v11abc"), "pw")
            .unwrap_err()
            .contains("v10"));
        assert!(open(&BASE64_STANDARD.encode(b"v10"), "pw").unwrap_err().contains("v10"));
        let sealed = seal("secret-token-value", "right");
        assert!(open(&sealed, "wrong").is_err() || open(&sealed, "wrong").unwrap() != "secret-token-value");
        // Not UTF-8 after a valid decrypt
        let key = derive_key("pw");
        let mut buf = vec![0u8; 32];
        buf[..2].copy_from_slice(&[0xff, 0xfe]);
        let c = Aes128CbcEnc::new(&key.into(), &IV.into())
            .encrypt_padded_mut::<Pkcs7>(&mut buf, 2)
            .unwrap()
            .to_vec();
        let mut blob = b"v10".to_vec();
        blob.extend(c);
        assert!(open(&BASE64_STANDARD.encode(blob), "pw").unwrap_err().contains("UTF-8"));
    }
}

pub mod apply;
#[cfg(test)]
mod apply_tests;
pub mod payloads;
pub mod server;

use serde::{Deserialize, Serialize};

pub const SYNC_SCHEMA_VERSION: u32 = 2;

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SyncTopic {
    Sales,
    Inventory,
    Purchases,
    Cash,
    Catalog,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncEnvelope<T> {
    pub sync_id: String,
    pub device_id: String,
    #[serde(default)]
    pub store_id: i64,
    #[serde(default)]
    pub store_code: Option<String>,
    pub topic: SyncTopic,
    pub schema_version: u32,
    pub sent_at: String,
    pub payload: T,
}

impl<T> SyncEnvelope<T> {
    pub fn new(
        device_id: impl Into<String>,
        store_code: Option<String>,
        topic: SyncTopic,
        sent_at: String,
        payload: T,
    ) -> Self {
        Self {
            sync_id: uuid::Uuid::new_v4().to_string(),
            device_id: device_id.into(),
            store_id: 0,
            store_code,
            topic,
            schema_version: SYNC_SCHEMA_VERSION,
            sent_at,
            payload,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SyncItemStatus {
    Accepted,
    Duplicate,
    Rejected,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncItemAck {
    pub item_uuid: String,
    pub status: SyncItemStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary_id: Option<i64>,
}

impl SyncItemAck {
    pub fn accepted(item_uuid: impl Into<String>, primary_id: Option<i64>) -> Self {
        Self {
            item_uuid: item_uuid.into(),
            status: SyncItemStatus::Accepted,
            message: None,
            primary_id,
        }
    }

    pub fn duplicate(item_uuid: impl Into<String>) -> Self {
        Self {
            item_uuid: item_uuid.into(),
            status: SyncItemStatus::Duplicate,
            message: None,
            primary_id: None,
        }
    }

    pub fn rejected(item_uuid: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            item_uuid: item_uuid.into(),
            status: SyncItemStatus::Rejected,
            message: Some(message.into()),
            primary_id: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResponse {
    pub sync_id: String,
    pub topic: SyncTopic,
    pub acks: Vec<SyncItemAck>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use payloads::{SaleItemSync, SaleSync, SalesBatch};

    #[test]
    fn envelope_serializes_with_expected_json_shape() {
        let sale = SaleSync {
            sync_uuid: "11111111-2222-3333-4444-555555555555".to_string(),
            local_order_id: 42,
            seller_username: Some("vendedor1".to_string()),
            client_document: None,
            client_phone: None,
            client_name: Some("Cliente S.A.".to_string()),
            payment_method: "yape".to_string(),
            subtotal: 84.74,
            igv: 15.26,
            total: 100.0,
            cash_session_uuid: Some("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee".to_string()),
            created_at: "2026-08-23 14:30:00".to_string(),
            items: vec![SaleItemSync {
                product_code: Some("SHO-001".to_string()),
                product_name: "Short Talla M".to_string(),
                unit_price: 50.0,
                quantity: 2,
                subtotal: 100.0,
            }],
        };
        let batch = SalesBatch { sales: vec![sale] };
        let env = SyncEnvelope::new(
            "replica-gamarra-01",
            Some("GAMARRA".to_string()),
            SyncTopic::Sales,
            "2026-08-23T14:31:00-05:00".to_string(),
            batch,
        );

        let json = serde_json::to_value(&env).unwrap();

        assert_eq!(json["topic"], "sales");
        assert_eq!(json["device_id"], "replica-gamarra-01");
        assert_eq!(json["store_code"], "GAMARRA");
        assert_eq!(json["schema_version"], SYNC_SCHEMA_VERSION);
        assert_eq!(json["payload"]["sales"][0]["payment_method"], "yape");
        assert_eq!(
            json["payload"]["sales"][0]["items"][0]["product_code"],
            "SHO-001"
        );
        assert!(json["payload"]["sales"][0]["client_document"].is_null());
    }

    #[test]
    fn ack_response_round_trips() {
        let resp = SyncResponse {
            sync_id: "sync-1".to_string(),
            topic: SyncTopic::Sales,
            acks: vec![
                SyncItemAck::accepted("u1", Some(99)),
                SyncItemAck::duplicate("u2"),
                SyncItemAck::rejected("u3", "stock insuficiente"),
            ],
        };

        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["acks"][0]["status"], "accepted");
        assert_eq!(json["acks"][1]["status"], "duplicate");
        assert_eq!(json["acks"][2]["message"], "stock insuficiente");

        let parsed: SyncResponse = serde_json::from_value(json).unwrap();
        assert_eq!(parsed.acks.len(), 3);
        assert_eq!(parsed.acks[0].primary_id, Some(99));
    }
}

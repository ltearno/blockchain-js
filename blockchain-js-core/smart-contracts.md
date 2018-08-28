# Smart contract implementation

## Contract informations

Contract information is stored in a key-value space in the blockchain

kv space for a smart contract

CONTRACT_UUID is a universally unique identifier for the contract 
ITERATION_ID is the contract version, always the latest version is used

/smartcontracts/CONTRACT_UUID

/smartcontracts/CONTRACT_UUID/ITERATION_ID contains a SignedPackedData with : name, description and code

/smartcontracts/CONTRACT_UUID/ITERATION_ID/code : javascript code
/smartcontracts/CONTRACT_UUID/ITERATION_ID/publicKey : public key of the contract owner
/smartcontracts/CONTRACT_UUID/ITERATION_ID/sig : signature of the contract (should match the publick key)

smart contract state : at the beginning it is an empty object {} it is reprocessed each time a new block is processed.

## Contract calls

Calls are UUIDed and are stored directly as an item in the blockchain.

Provided a block chain version, there is only ONE possible serialization order for contract calls. So we can implement transactions on top of that if we need to ;)

At least inc/dec primitives should be relatively easy to implement.

smart contract calls :
- call uuid,
- contract uuid,
- contract iteration_id,
- function to call,
- named parameters
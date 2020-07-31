const crypto = require("crypto");
const prove = require("./prove");
const verify = require("./verify");
const uuid = require('node-uuid');
const BigNumber = require('bignumber.js');

class Blockchain {
    constructor() {
        this.chain = [];
        this.pendingTransactions = [];
        this.peers = new Set();
        this.address = uuid.v1().split('-').join("");
        this.newBlock();
    }

    /**
     * Adds a node to our peer table
     */
    addPeer(address) {
        this.peers.add(address);
    }

    /**
     * Gets peers from our peer table
     */
    getPeers() {
        return Array.from(this.peers);
    }

    /**
     * Adds a transaction to pending list
     * @param recipient can be a smart contract or external owner account
     */
    addTransaction(sender, recipient) {
        let tx = {
            timestamp: new Date().toISOString(),
            sender,
            recipient
        };

        tx.hash = Blockchain.hash(tx);

        console.log(`Added transaction ${tx.hash}`);

        this.pendingTransactions.push(tx);
    }

    /**
     * Creates a new block containing any outstanding transactions
     */
    async newBlock() {
        let localDifficulty = 1;
        let currentTransactions = [];

        // Genesis block no need to mine
        if (this.chain.length > 0) {
            var res = await this.mine();

            currentTransactions = res['currentTransactions'];
            localDifficulty = res['localDifficulty'];

            if (currentTransactions == false) {
                console.log("Not satisfy the difficulty!");
                return false;
            }
        } else {
            console.log("Initialize the genesis block.")
        }

        // Give reward to miner
        let tx = {
            timestamp: new Date().toISOString(),
            sender: null,
            recipient: this.address
        };

        tx.hash = Blockchain.hash(tx);

        // Put it on the first position
        currentTransactions.unshift(tx);

        let block = {
            index: this.chain.length,
            timestamp: new Date().toISOString(),
            transactions: currentTransactions,
            previousHash: this.lastBlock.hash,
            nonce: Blockchain.nonce(),
            localDifficulty
        };

        block.hash = Blockchain.hash(block);

        // Add the new block to the blockchain
        this.chain.push(block);

        console.log(`Created block ${block.index}`);
        console.log(` - Block hash: ${Blockchain.hash(block)}`);
        console.log(` - nonce:      ${block.nonce}`);

        let peers = this.getPeers();
        for (var i = peers.length - 1; i >= 0; i--) {
            console.log(`Broadcast block ${block.index} to peer ${peers[i].address}`);
            peers[i].syncChain();
        }
    }

    /**
     * Generates a SHA-256 hash of the block
     */
    static hash(block) {
        const blockString = JSON.stringify(block, Object.keys(block).sort());
        return crypto.createHash("sha256").update(blockString).digest("hex");
    }

    /**
     * Returns the last block in the chain
     */
    lastBlock() {
        return this.chain.length && this.chain[this.chain.length - 1];
    }

    /**
     * Generates a random 32 byte string
     */
    static nonce() {
        return crypto.createHash("sha256").update(crypto.randomBytes(32)).digest("hex");
    }

    /**
     * Proof of Data mining algorithm
     *
     * We hash the block with random string until the hash begins with
     * a "difficulty" number of 0s.
     */
    async mine() {
        const minDifficulty = 4;
        const blockInterval = 14;
        let lastBlock = this.lastBlock();

        if (lastBlock == false) return false;
        let localDifficulty = lastBlock.localDifficulty;

        // Adjust localDifficulty every 10 blocks
        if (this.chain.length % 10 == 0 && this.chain.length != 0) {
            let startTime = new Date(this.chain[this.chain.length-10]).getTime();
            let endTime = new Date(this.chain[this.chain.length-1]).getTime();
            localDifficulty = localDifficulty*(endTime-startTime)/(1000*10*blockInterval);
        }

        // Normalize hash value to [0,1]
        var r = crypto.createHash("sha256").update(Blockchain.hash(lastBlock) + this.address).digest("hex");
        var b = BigNumber(r, 16);
        var c = BigNumber("f".repeat(64), 16);
        // Mimic lottery-like mechanism, calculate difficulty
        var difficulty = parseInt(minDifficulty - localDifficulty * Math.log(parseFloat(b.dividedBy(c).toString())));

        console.log(Math.log(parseFloat(b.dividedBy(c).toString())));

        console.log(`localDifficulty: ${localDifficulty}, difficulty: ${difficulty}`);

        let currentTransactions = [];

        if (this.pendingTransactions.length < difficulty) return false;

        while (difficulty--) {
            let tx = this.pendingTransactions[0];
            this.pendingTransactions.shift();
            const { proof, publicSignals } = await prove.Prove({a:2,b:11});
            tx.proof = proof;
            tx.publicSignals = publicSignals;
            tx.index = currentTransactions.length;
            currentTransactions.push(tx);
        }

        return {currentTransactions, localDifficulty};
    }

    async syncChain(chain) {
        if (chain.length <= this.chain.length) return false;

        console.log()

        for (var j = chain.length - 1; j >= 0; j--) {
            var block = chain[j];
            for (var i = block.transactions.length - 1; i > 0; i--) {
                var proof = block.transactions[i].proof;
                var publicSignals = block.transactions[i].publicSignals;
                let res = await verify.Verify(proof, publicSignals);
                if (res == false) {
                    console.log("Verify failed, reject this chain!");
                    return false;
                }
            }
        }

        this.chain = chain;

        console.log("Synchronize successfully.");

        console.log(this.chain);

    }
}

module.exports = Blockchain;

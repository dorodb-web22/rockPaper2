// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Simple Rock-Paper-Scissors (commit-reveal, no deployment inputs)
/// @author
/// @notice Beginner-friendly two-player RPS. No bets; just game logic and winner resolution.
/// @dev Moves: 0 = Rock, 1 = Paper, 2 = Scissors
contract RockPaperScissors {
    enum Stage { Created, Committed, Revealed, Finished }

    struct Game {
        address playerA;
        address playerB;
        bytes32 commitA;      // keccak256(move + nonce) from playerA
        bytes32 commitB;      // keccak256(move + nonce) from playerB
        uint8 moveA;          // revealed moveA (0,1,2)
        uint8 moveB;          // revealed moveB (0,1,2)
        bool revealedA;
        bool revealedB;
        Stage stage;
        uint256 commitTime;   // timestamp when last commit was made
    }

    uint256 public nextGameId = 1;
    mapping(uint256 => Game) public games;

    // How long (in seconds) a player has to reveal after both commits are in
    uint256 public constant REVEAL_TIMEOUT = 1 hours;

    event GameCreated(uint256 indexed gameId, address indexed creator);
    event Committed(uint256 indexed gameId, address indexed player);
    event Revealed(uint256 indexed gameId, address indexed player, uint8 move);
    event GameResolved(uint256 indexed gameId, address winner, uint8 moveA, uint8 moveB);
    event ClaimTimeout(uint256 indexed gameId, address claimer);

    /// @notice Create a new empty game. No inputs required.
    /// @return gameId the id of the newly created game.
    function createGame() external returns (uint256 gameId) {
        gameId = nextGameId++;
        Game storage g = games[gameId];
        g.playerA = msg.sender;
        g.stage = Stage.Created;
        emit GameCreated(gameId, msg.sender);
    }

    /// @notice Join an existing game as playerB (only allowed if game is in Created stage).
    /// @param gameId The id of the game to join.
    function joinGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.playerA != address(0), "Game does not exist");
        require(g.playerB == address(0), "Already joined");
        require(g.playerA != msg.sender, "Cannot join your own game");
        require(g.stage == Stage.Created, "Game not joinable");
        g.playerB = msg.sender;
    }

    /// @notice Submit a commitment hash (keccak256(move, nonce)) for a game.
    /// @param gameId The game id
    /// @param commitment The keccak256 hash of the move and nonce
    function commitMove(uint256 gameId, bytes32 commitment) external {
        Game storage g = games[gameId];
        require(g.playerA != address(0) && g.playerB != address(0), "Game not ready");
        require(g.stage == Stage.Created || g.stage == Stage.Committed, "Cannot commit now");

        if (msg.sender == g.playerA) {
            require(g.commitA == bytes32(0), "PlayerA already committed");
            g.commitA = commitment;
        } else if (msg.sender == g.playerB) {
            require(g.commitB == bytes32(0), "PlayerB already committed");
            g.commitB = commitment;
        } else {
            revert("Only players may commit");
        }

        // If both players have now committed, move to Committed stage and set commitTime
        if (g.commitA != bytes32(0) && g.commitB != bytes32(0)) {
            g.stage = Stage.Committed;
            g.commitTime = block.timestamp;
        } else {
            // still waiting for the other player
            g.stage = Stage.Created;
        }

        emit Committed(gameId, msg.sender);
    }

    /// @notice Reveal your move and nonce to complete the commit-reveal.
    /// @param gameId The game id
    /// @param move 0=Rock,1=Paper,2=Scissors
    /// @param nonce The original nonce used when creating the commitment
    function revealMove(uint256 gameId, uint8 move, string calldata nonce) external {
        require(move <= 2, "Invalid move");
        Game storage g = games[gameId];
        require(g.stage == Stage.Committed, "Reveals not allowed now");
        bytes32 computed = keccak256(abi.encodePacked(move, nonce));

        if (msg.sender == g.playerA) {
            require(!g.revealedA, "Already revealed");
            require(g.commitA == computed, "Commitment mismatch for A");
            g.moveA = move;
            g.revealedA = true;
            emit Revealed(gameId, msg.sender, move);
        } else if (msg.sender == g.playerB) {
            require(!g.revealedB, "Already revealed");
            require(g.commitB == computed, "Commitment mismatch for B");
            g.moveB = move;
            g.revealedB = true;
            emit Revealed(gameId, msg.sender, move);
        } else {
            revert("Only players may reveal");
        }

        // If both revealed, decide winner
        if (g.revealedA && g.revealedB) {
            _resolve(gameId);
        }
    }

    /// @notice If opponent fails to reveal within timeout, the other player can claim the win.
    /// @param gameId The game id
    function claimTimeout(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.stage == Stage.Committed, "Not in committed stage");
        require(block.timestamp >= g.commitTime + REVEAL_TIMEOUT, "Reveal period not over");

        // If one player revealed and the other didn't, revealer wins.
        if (g.revealedA && !g.revealedB) {
            g.stage = Stage.Finished;
            emit ClaimTimeout(gameId, g.playerA);
            emit GameResolved(gameId, g.playerA, g.moveA, g.moveB);
            return;
        } else if (g.revealedB && !g.revealedA) {
            g.stage = Stage.Finished;
            emit ClaimTimeout(gameId, g.playerB);
            emit GameResolved(gameId, g.playerB, g.moveA, g.moveB);
            return;
        }

        revert("Cannot claim: either both revealed or none revealed");
    }

    /// @dev Internal resolver using standard RPS rules.
    function _resolve(uint256 gameId) internal {
        Game storage g = games[gameId];
        require(g.revealedA && g.revealedB, "Both must reveal");

        // 0 rock, 1 paper, 2 scissors
        if (g.moveA == g.moveB) {
            // tie -> no winner, mark finished
            g.stage = Stage.Finished;
            emit GameResolved(gameId, address(0), g.moveA, g.moveB);
            return;
        }

        // A beats B if (moveA + 3 - moveB) % 3 == 1
        uint8 result = (g.moveA + 3 - g.moveB) % 3;
        address winner = result == 1 ? g.playerA : g.playerB;

        g.stage = Stage.Finished;
        emit GameResolved(gameId, winner, g.moveA, g.moveB);
    }

    /// @notice Helper: compute the commitment off-chain (client-side) the same way the contract does.
    /// @dev This view returns keccak256(abi.encodePacked(move, nonce)) — useful only for testing in-readers.
    function computeCommitment(uint8 move, string calldata nonce) external pure returns (bytes32) {
        require(move <= 2, "Invalid move");
        return keccak256(abi.encodePacked(move, nonce));
    }
}
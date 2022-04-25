"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const twitter_api_sdk_1 = require("twitter-api-sdk");
require("dotenv/config");
// @ts-ignore
const express_1 = __importDefault(require("express"));
// @ts-ignore
const cors_1 = __importDefault(require("cors"));
const twitterClient = new twitter_api_sdk_1.Client(process.env.BEARER_TOKEN || '');
function lookupUser(name) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const resp = yield twitterClient.users.findUserByUsername(name);
        return (_a = resp.data) === null || _a === void 0 ? void 0 : _a.id;
    });
}
function getSpaces(filters) {
    return __awaiter(this, void 0, void 0, function* () {
        const [nameFilters, [stateFilter]] = filters;
        // console.debug("state filter", stateFilter);
        const gettingSpaces = nameFilters.map((filter) => __awaiter(this, void 0, void 0, function* () { return yield twitterClient.spaces.searchSpaces({ query: filter.value, "space.fields": ["title", "speaker_ids", "creator_id", "host_ids", "scheduled_start"], state: stateFilter.value }); }));
        const spacesResults = (yield Promise.all(gettingSpaces));
        const spaces = spacesResults.map(({ data }) => data).flat();
        return spaces;
    });
}
function userFilterSpaces(spaces, filters) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = filters.map(filter => filter.value);
        const spacesIncludingGivenUsers = spaces.filter(space => {
            // users are found in creator_id or host_ids or speaker_ids
            if (space.creator_id != "" && users.includes(space.creator_id)) {
                return true;
            }
            else if (space.host_ids && space.host_ids.length > 0) {
                const spaceHosts = space.host_ids || [];
                const hasDesiredHost = users.find((user) => spaceHosts.includes(user));
                return !!hasDesiredHost;
            }
            else if (space.speaker_ids && space.speaker_ids.length > 0) {
                const spaceSpeakers = space.speaker_ids || [];
                const hasDesiredSpeaker = users.find((user) => spaceSpeakers.includes(user));
                return !!hasDesiredSpeaker;
            }
        });
        return spacesIncludingGivenUsers;
    });
}
function filterSpaces(filters) {
    return __awaiter(this, void 0, void 0, function* () {
        const [nameFilters, userFilters, stateFilter] = filters;
        // get spaces
        // console.debug("name filters", nameFilters);
        const nameFilteredSpaces = yield getSpaces([nameFilters, stateFilter]);
        // console.debug("name filtered spaces", nameFilteredSpaces);
        const userFilteredSpaces = yield userFilterSpaces(nameFilteredSpaces, userFilters);
        return userFilteredSpaces;
        // apply filters to spaces
        // return the filtered spaces
    });
}
function main(filters) {
    return __awaiter(this, void 0, void 0, function* () {
        // get list of spaces that match the name filters
        const nameFilters = filters.filter(filter => filter.type === 'name');
        const userFilters = filters.filter(filter => filter.type === 'user');
        const stateFilter = filters.filter(filter => filter.type === 'state');
        const gettingUserFilterWithIds = userFilters.map((filter) => __awaiter(this, void 0, void 0, function* () {
            const userID = yield lookupUser(filter.value);
            return Object.assign(Object.assign({}, filter), { value: userID });
        }));
        const userFiltersWithIds = yield Promise.all(gettingUserFilterWithIds);
        // console.debug("user ids", userFiltersWithIds);
        const spaces = yield filterSpaces([nameFilters, userFiltersWithIds, stateFilter]);
        return spaces;
    });
}
function nameFilter(name) { return { type: 'name', value: name }; }
;
function userFilter(user) { return { type: 'user', value: user }; }
;
function stateFilter(state) { return { type: 'state', value: state }; }
;
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const defaultState = stateFilter('scheduled');
app.get('/', (req, res) => {
    res.send('Hello world');
});
app.post('/spaces', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('request received', req.body);
    const input = req.body;
    const name = input.name;
    const user = input.user;
    if (name == "" || user == "") {
        return res.json({ error: "Both name and user must be provided" });
    }
    const spaces = yield main([nameFilter(name), userFilter(user), defaultState]);
    console.debug("filtered response", spaces);
    res.json({ data: spaces });
}));
app.listen(port, () => {
    return console.log(`Express is listening on port: ${port}`);
});
// async function manualRun() {
//     const users = ['CryptoAcade'];
//     const names = ['crypto'];
//     const state = stateFilter('scheduled');
//     const nameFilters = names.map(nameFilter);
//     const userFilters = users.map(userFilter);
//     const spaces = await main([...nameFilters, ...userFilters, state] as Filter[]);
//     console.log('manual run', spaces);
// }
// manualRun();

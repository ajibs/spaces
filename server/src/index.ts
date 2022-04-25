import {Client} from 'twitter-api-sdk';
import 'dotenv/config';
// @ts-ignore
import express from 'express';
// @ts-ignore
import cors from 'cors';

const twitterClient = new Client(process.env.BEARER_TOKEN || '');

async function lookupUser(name: string) {
    const resp = await twitterClient.users.findUserByUsername(name);
    return resp.data?.id;
}

async function getSpaces(filters: any) {
    const [nameFilters, [stateFilter]] = filters;
    // console.debug("state filter", stateFilter);

    const gettingSpaces = nameFilters.map(async (filter: any) => await twitterClient.spaces.searchSpaces({query: filter.value, "space.fields": ["title","speaker_ids","creator_id","host_ids","scheduled_start"], state: stateFilter.value}) as any);
    const spacesResults = (await Promise.all(gettingSpaces));
    const spaces = spacesResults.map(({data}) => data).flat();
    return spaces;
}

async function userFilterSpaces(spaces: any[], filters: Filter[]) {
    const users = filters.map(filter => filter.value);

    const spacesIncludingGivenUsers = spaces.filter(space => {
        // users are found in creator_id or host_ids or speaker_ids
        if (space.creator_id != "" && users.includes(space.creator_id)) {
            return true;
        } else if (space.host_ids && space.host_ids.length > 0) {
            const spaceHosts = space.host_ids || [];
            const hasDesiredHost = users.find((user) => spaceHosts.includes(user));
            return !!hasDesiredHost;
        } else if (space.speaker_ids && space.speaker_ids.length > 0) {
            const spaceSpeakers = space.speaker_ids || [];
            const hasDesiredSpeaker = users.find((user) => spaceSpeakers.includes(user));
            return !!hasDesiredSpeaker;
        }
    });

    return spacesIncludingGivenUsers;
}

async function filterSpaces(filters: any) { 
    const [nameFilters, userFilters, stateFilter] = filters;
    // get spaces
    // console.debug("name filters", nameFilters);

    const nameFilteredSpaces = await getSpaces([nameFilters, stateFilter]);
    // console.debug("name filtered spaces", nameFilteredSpaces);

    const userFilteredSpaces = await userFilterSpaces(nameFilteredSpaces, userFilters);
    return userFilteredSpaces;
    // apply filters to spaces
    // return the filtered spaces
}

async function main(filters: Filter[]) {
    // get list of spaces that match the name filters
    const nameFilters = filters.filter(filter => filter.type === 'name');
    const userFilters = filters.filter(filter => filter.type === 'user');
    const stateFilter = filters.filter(filter => filter.type === 'state');

    const gettingUserFilterWithIds = userFilters.map(async filter => {
        const userID = await lookupUser(filter.value);
        return {...filter, value: userID};
    });
    const userFiltersWithIds = await Promise.all(gettingUserFilterWithIds);
    // console.debug("user ids", userFiltersWithIds);

    const spaces = await filterSpaces([nameFilters, userFiltersWithIds, stateFilter]);
    return spaces;
}

interface UserFilter {
    type: 'user';
    value: string;
}

interface NameFilter {
    type: 'name';
    value: string;
}

interface StateFilter {
    type: 'state';
    value: 'live' | 'scheduled' | 'all';
}

type Filter = UserFilter | NameFilter | StateFilter;

function nameFilter(name: string) { return { type: 'name', value: name}};
function userFilter(user: string) { return { type: 'user', value: user}};
function stateFilter(state: string) { return { type: 'state', value: state}};

const app = express();
const port = process.env.PORT || 8080;

app.use(cors())
app.use(express.json());
const defaultState = stateFilter('scheduled');

app.get('/', (req: any, res: any) => {
    res.send('Hello world');
});

app.post('/spaces', async (req: any, res: any) => {
    console.log('request received', req.body);
    const input = req.body;
    const name = input.name;
    const user = input.user;

    if (name == "" || user == "") {
        return res.json({ error: "Both name and user must be provided" });
    }

    const spaces = await main([nameFilter(name), userFilter(user), defaultState] as Filter[]);
    console.debug("filtered response", spaces);
    res.json({data: spaces});
})

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
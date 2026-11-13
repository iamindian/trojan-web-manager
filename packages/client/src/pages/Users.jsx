import { useState, useEffect, useRef, useCallback } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import InfiniteLoader from "react-window-infinite-loader";
import axios from "axios";
import moment from "moment";
import { Alert, Box, Button, Link, TextField, Toolbar, Typography } from "@mui/material";

const prefix = import.meta.env.VITE_API_PREFIX;
const columns = "80px minmax(180px, 1fr) 120px 160px 180px";
const rowStyle = { display: "grid", gridTemplateColumns: columns, alignItems: "center" };
const cellStyle = { px: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

function UsersTable({ username }) {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(null);
    const [error, setError] = useState("");
    const [scrollbarWidth, setScrollbarWidth] = useState(0);
    const loadedUsers = useRef([]);
    const pending = useRef(null);
    const controller = useRef(null);
    const loader = useRef(null);
    const hasNextPage = !error && (total === null || users.length < total);
    const itemCount = hasNextPage ? users.length + 1 : users.length;
    const isItemLoaded = index => index < users.length;
    const measureScrollbar = useCallback(element => {
        if (element) setScrollbarWidth(element.offsetWidth - element.clientWidth);
    }, []);

    const loadMoreItems = useCallback(() => {
        if (pending.current) return pending.current;
        const requestController = new AbortController();
        controller.current = requestController;
        pending.current = axios.get(`${prefix}/users`, {
            params: { offset: loadedUsers.current.length, limit: 25, username },
            signal: requestController.signal,
        }).then(({ data }) => {
            if (requestController.signal.aborted) return;
            if (data.error) throw new Error(data.error);
            loadedUsers.current = [...loadedUsers.current, ...data.users];
            setUsers(loadedUsers.current);
            setTotal(data.users.length ? data.total : loadedUsers.current.length);
        }).catch(error => {
            if (!requestController.signal.aborted) {
                setError(error.response?.data?.error || error.message);
            }
        }).finally(() => {
            if (controller.current === requestController) pending.current = null;
        });
        return pending.current;
    }, [username]);

    useEffect(() => () => controller.current?.abort(), []);

    const Row = ({ index, style }) => {
        const user = users[index];
        if (!user) {
            return <Box role="row" style={style}><Box role="cell" sx={cellStyle}>Loading...</Box></Box>;
        }
        return (
            <Box role="row" aria-rowindex={index + 2} style={style}
                onClick={() => navigate(`/admin/${user.id}`)}
                sx={{ ...rowStyle, cursor: "pointer", borderBottom: 1, borderColor: "divider",
                    "&:hover": { bgcolor: "action.hover" } }}>
                <Box role="cell" sx={cellStyle}>{user.id}</Box>
                <Box role="cell" sx={cellStyle}>
                    <Link component={RouterLink} to={`/admin/${user.id}`}
                        onClick={event => event.stopPropagation()} title={user.username}>
                        {user.username}
                    </Link>
                </Box>
                <Box role="cell" sx={{ ...cellStyle, textAlign: "right" }}>{user.quota}</Box>
                <Box role="cell" sx={cellStyle}>
                    {user.start ? moment(user.start).format("MMM Do YY") : "--"}
                </Box>
                <Box role="cell" sx={{ ...cellStyle, textAlign: "right" }}>{user.delta}</Box>
            </Box>
        );
    };

    return (
        <>
            {error && (
                <Alert severity="error" action={
                    <Button color="inherit" onClick={() => {
                        setError("");
                        loader.current?.resetloadMoreItemsCache();
                        loadMoreItems();
                    }}>Retry</Button>
                }>{error}</Alert>
            )}
            <Box sx={{ flex: 1, minHeight: 0, overflowX: "auto" }}>
                <Box role="table" aria-label="Users" aria-colcount={5}
                    aria-rowcount={total === null ? -1 : total + 1}
                    sx={{ minWidth: 740, height: "100%", display: "flex", flexDirection: "column" }}>
                    <Box role="rowgroup">
                        <Box role="row" sx={{ ...rowStyle, height: 40, fontWeight: "bold",
                            borderBottom: 1, borderColor: "divider", pr: `${scrollbarWidth}px` }}>
                            {["ID", "Username", "Quota", "Start", "Duration (months)"].map((label, index) => (
                                <Box key={label} role="columnheader"
                                    sx={{ ...cellStyle, textAlign: index === 2 || index === 4 ? "right" : "left" }}>
                                    {label}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                    <Box role="rowgroup" sx={{ flex: 1, minHeight: 0 }}>
                        {!hasNextPage && !error && users.length === 0 ? (
                            <Typography sx={{ p: 2 }}>No users found.</Typography>
                        ) : (
                            <AutoSizer>
                                {({ height, width }) => (
                                    <InfiniteLoader ref={loader} isItemLoaded={isItemLoaded}
                                        itemCount={itemCount} loadMoreItems={loadMoreItems}>
                                        {({ onItemsRendered, ref }) => (
                                            <List ref={ref} className="List" height={height} width={width}
                                                itemCount={itemCount} itemSize={40} onItemsRendered={onItemsRendered}
                                                outerRef={measureScrollbar} style={{ scrollbarGutter: "stable" }}>
                                                {Row}
                                            </List>
                                        )}
                                    </InfiniteLoader>
                                )}
                            </AutoSizer>
                        )}
                    </Box>
                </Box>
            </Box>
        </>
    );
}

function Users() {
    const [search, setSearch] = useState("");
    const [username, setUsername] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => setUsername(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    return (
        <Box sx={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
            <Toolbar />
            <Box sx={{ p: 2 }}>
                <TextField fullWidth size="small" label="Search username" value={search}
                    onChange={event => setSearch(event.target.value)}
                    helperText="Matches anywhere in the username. Use * as a wildcard, e.g. alice*."
                />
            </Box>
            <UsersTable key={username} username={username} />
        </Box>
    );
}

export function Component() {
    return <Users />;
}
Component.displayName = "Users";

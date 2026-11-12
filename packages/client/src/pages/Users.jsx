import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import InfinitLoader from "react-window-infinite-loader"
import useGetUsers from "../hooks/useGetUsers";
import { useState, useEffect, useRef ,forwardRef} from "react";
import { useNavigate } from "react-router-dom";
import moment from 'moment';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
function Users() {
    const ITEM_SIZE = 35;
    const PADDING_SIZE = 5;
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    // const [isNextPageLoading, setIsNextPageLoading] = useState(false);
    const isNextPageLoading = useRef(false);
    const [, getUsers] = useGetUsers();
    const total = useRef(1000);
    const hasNextPage = useRef(true);
    const isItemLoaded = index => index < users.length;
    const itemCount = hasNextPage.current ? users.length + 5 : users.length;
    const loadMoreItems = async (startIndex, stopIndex) => {
        if (isNextPageLoading.current) {
            return Promise.resolve();
        }
        isNextPageLoading.current = true;
        return new Promise(resolve => {

            getUsers(startIndex, (stopIndex - startIndex) + 1).then((resp) => {
                const rUsers = resp.data.users;
                total.current = resp.data.total;
                const joined = [...users, ...rUsers]
                if (joined.length === resp.data.total) {
                    hasNextPage.current = false;
                }
                setUsers(joined);
                isNextPageLoading.current = false;
                resolve();
            })


        })
    }
    const click = (id) => {
        navigate('/admin/' + id);
    }
    const Row = ({ index, style }) => {
        let label;
        style = Object.assign({}, style, { textAlign: "center", lineHeight:"35px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })
        if (isItemLoaded(index)) {
            const user = users[index];
            label = `Username: ${user.username} , Quota: ${user.quota} , Start: ${moment(user.start).format("MMM Do YY")} , Delta: ${user.delta}`;
        } else {
            label = "loading";
        }
        return (<div onClick={() => {
            if (isItemLoaded(index)) click(users[index].id);
        }} className="List-item" style={style} title={label}>
            {label}
        </div>);
    };
    useEffect(() => {
        loadMoreItems(0, 10);
    }, [])
    const innerElementType = forwardRef(({ style, ...rest }, ref) => (
        <div
            ref={ref}
            style={{
                ...style,
                height: `${parseFloat(style.height) + PADDING_SIZE * 2}px`
            }}
            {...rest}
        />
    ));
    return (<Box sx={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
        <Toolbar />
        <Typography sx={{ fontSize: 20, textAlign: "center" }} color="text.secondary">
            Users
        </Typography>
        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
            <AutoSizer>

                {({ height, width }) => (

                    <InfinitLoader isItemLoaded={isItemLoaded} itemCount={itemCount} loadMoreItems={loadMoreItems}>
                        {({ onItemsRendered, ref }) => (
                            <List
                                ref={ref}
                                className="List"
                                height={height}
                                itemCount={itemCount}
                                itemSize={ITEM_SIZE}
                                width={width}
                                onItemsRendered={onItemsRendered}
                                innerElementType={innerElementType}
                            >
                                {Row}
                            </List>
                        )}
                    </InfinitLoader>

                )}

            </AutoSizer>
        </Box>
    </Box>);
}
export function Component() {
    return Users();
}
Component.displayName = "Users";
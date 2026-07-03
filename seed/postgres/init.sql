-- Auto-run by the official postgres image's docker-entrypoint-initdb.d
-- convention on first container start. Proves the local-first stack seeds
-- itself: test_local_stack.py asserts this table is non-empty.
create table if not exists seed_check (
    id serial primary key,
    note text not null
);

insert into seed_check (note) values ('weave local-first stack seed');
